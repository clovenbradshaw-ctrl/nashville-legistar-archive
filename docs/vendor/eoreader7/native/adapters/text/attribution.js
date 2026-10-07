// native/adapters/text/attribution.js — who is speaking, in prose.
//
// The medium-specific half of perspective (READING-SPEC S6: the kernel takes
// a holder as caller annotation and never asks how it was found; quotation
// marks and speech verbs are English prose's own grammar and belong here).
//
// Frankenstein is the specimen this was built against because its whole
// construction is the problem: Walton writes letters containing Victor's
// telling containing the creature's telling. A reader who loses that nesting
// reads a different book — one where the creature's account of Felix and
// Safie is simply what happened, rather than what a being with every reason
// to be believed says happened, relayed by a man with every reason not to
// believe him, written down by a third who met neither at the time.
//
// TWO MECHANISMS, AND THEY ARE DIFFERENT CLAIMS:
//
//   quotationFrames(text)  — DERIVED, byte-level, no prior. Quoted spans,
//     including the continued-quotation convention (a paragraph that opens
//     with a quote mark and never closes it hands the quotation on to the
//     next paragraph). This is a real convention in the received bytes, not
//     a guess about content: measured on pg84, chapters 11-16 are exactly
//     the run of paragraphs carrying it, which is the creature's narration.
//
//   narrationFrames(text, { framePrior }) — INJECTED. Who "I" is when
//     nothing is quoted cannot be read off punctuation, and P3 is explicit:
//     priors are injected, never derived, and a missing prior is never
//     patched by loosening a gate. With no prior this returns a typed gap
//     naming what it lacks. It does NOT guess a narrator.
//
// THE SPEECH VERB IS NOT A HAND-TYPED LIST. That was the first cut and it
// is the exact mistake both repos' CLAUDE.md files record ("a 90-word
// hand-listed verb string was not a simplification of English, it was a
// sample of it standing in for the whole"). Instead the attribution slot is
// filled only when the POS prior's own treebank counts call the candidate a
// VERB, and the name slot only when the surface is a referent this reading
// has ALREADY ADMITTED. The prior refuses; it never admits (P3). So
// "said Clerval" attributes and "the pines Clerval" does not, without anyone
// writing down which English words are speech verbs.

const OPEN = "“"; // “
const CLOSE = "”"; // ”
const STRAIGHT = '"';

const freeze = Object.freeze;

/** Paragraphs, with their byte offsets kept — every span this module emits
 * is re-sliceable against the received bytes (P5.2). */
const paragraphs = (text, offset = 0) => {
  const out = [];
  let at = 0;
  for (const raw of text.split(/\n\s*\n/)) {
    const start = text.indexOf(raw, at);
    out.push({ text: raw, start: start + offset, end: start + raw.length + offset });
    at = start + raw.length;
  }
  return out;
};

const countMarks = (s) => {
  let open = 0, close = 0, straight = 0;
  for (const ch of s) { if (ch === OPEN) open += 1; else if (ch === CLOSE) close += 1; else if (ch === STRAIGHT) straight += 1; }
  return { open, close, straight };
};

/**
 * The quotation structure of the text, as the bytes carry it.
 *
 * Returns one entry per paragraph that participates in quoted material,
 * each typed by what the CONVENTION says it is:
 *   "closed"     — opens and closes within the paragraph (ordinary speech)
 *   "continued"  — opens and does not close: the quotation runs on, and
 *                  this paragraph is inside an embedded telling
 *   "resumed"    — continues one already open (opens again, no close)
 *   "closing"    — carries the close that ends a run
 *
 * `runs` groups consecutive continued/closing paragraphs into embedded
 * frames — the spans where someone other than the outer narrator is the "I".
 */
export function quotationFrames(text, { offset = 0 } = {}) {
  const paras = paragraphs(text, offset);
  const marked = [];
  const runs = [];
  let open = false;
  let run = null;
  for (const para of paras) {
    const n = countMarks(para.text);
    const hasAny = n.open + n.close + n.straight > 0;
    if (!hasAny && !open) continue;
    let type = null;
    if (!open && n.open > n.close) { type = "continued"; open = true; run = { start: para.start, end: para.end, paragraphs: 1 }; }
    else if (open && n.close >= n.open && n.close > 0) { type = "closing"; open = false; if (run) { run.end = para.end; run.paragraphs += 1; runs.push(freeze({ ...run })); run = null; } }
    else if (open) { type = "resumed"; if (run) { run.end = para.end; run.paragraphs += 1; } }
    else if (n.open > 0 && n.close > 0) type = "closed";
    if (type) marked.push(freeze({ type, byteStart: para.start, byteEnd: para.end, opener: para.text.slice(0, 60) }));
  }
  if (run) runs.push(freeze({ ...run, unclosed: true }));
  return freeze({
    schema: "EOQuotationFrames@1",
    basis: "the received bytes' own quotation convention — a paragraph that opens a quote and never closes it hands the quotation on",
    paragraphs: paras.length,
    marked: freeze(marked),
    // An embedded telling is a RUN of continued paragraphs. One paragraph of
    // ordinary dialogue is not a frame; a chapter of them is.
    embeddedFrames: freeze(runs.filter((r) => r.paragraphs >= 2)),
    counted: freeze({ closed: marked.filter((m) => m.type === "closed").length, continued: marked.filter((m) => m.type === "continued").length, runs: runs.length }),
  });
}

/**
 * The individual quoted spans, at their own boundaries rather than their
 * paragraph's.
 *
 * This exists because the first driver over `quotationFrames` attributed
 * 2.8% of Frankenstein's dialogue and the mechanism was not at fault: it was
 * handed paragraph edges, and `” said Clerval` sits INSIDE the paragraph,
 * immediately after the closing mark. A speaker tag is adjacent to the
 * QUOTE, not to the block that contains it (P5.5 — check the driver before
 * the theory).
 */
export function quotedSpans(text, { offset = 0 } = {}) {
  const spans = [];
  let open = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === OPEN) { open = i; continue; }
    if (ch === CLOSE && open >= 0) {
      spans.push(freeze({
        byteStart: open + offset,
        byteEnd: i + 1 + offset,
        // The words that touch this quotation on either side — the only
        // place a speaker tag can be.
        before: text.slice(Math.max(0, open - 90), open),
        after: text.slice(i + 1, i + 91),
        text: text.slice(open, i + 1),
      }));
      open = -1;
    }
  }
  return freeze({ schema: "EOQuotedSpans@1", spans: freeze(spans), unclosed: open >= 0 ? 1 : 0 });
}

/**
 * Attribute one quoted span to a speaker, from the words that touch it.
 *
 * `isVerb(word)` and `referentFor(surface)` are INJECTED — the POS prior and
 * this reading's own admitted cast. Neither is consulted for permission to
 * invent: `isVerb` can only refuse a candidate, and `referentFor` can only
 * return a being the reading already witnessed.
 *
 * Returns a typed gap rather than a guess. An unattributed quotation is an
 * ordinary, frequent, honest result: plenty of dialogue names no speaker,
 * and inventing one is worse than leaving the line unowned.
 */
export function attributeQuotation(before, after, { isVerb, referentFor }) {
  if (typeof isVerb !== "function" || typeof referentFor !== "function") {
    throw new TypeError("attributeQuotation: the verb prior and the admitted cast are injected — this organ derives neither (P3)");
  }
  const words = (s) => String(s ?? "").split(/[^\p{L}\p{N}’']+/u).filter(Boolean);
  // Trailing form: ” said Clerval  /  ” exclaimed Henry
  const tail = words(after).slice(0, 4);
  for (let i = 0; i + 1 < tail.length; i += 1) {
    if (!isVerb(tail[i])) continue;
    const ref = referentFor(tail[i + 1]);
    if (ref) return freeze({ speaker: ref, evidence: `${tail[i]} ${tail[i + 1]}`, form: "verb-then-name", basis: "the prior called it a verb; the reading had already admitted the name" });
  }
  // Leading form: Clerval said, “  /  Elizabeth replied: “
  const head = words(before).slice(-4);
  for (let i = 0; i + 1 < head.length; i += 1) {
    const ref = referentFor(head[i]);
    if (ref && isVerb(head[i + 1])) return freeze({ speaker: ref, evidence: `${head[i]} ${head[i + 1]}`, form: "name-then-verb", basis: "the prior called it a verb; the reading had already admitted the name" });
  }
  return freeze({ speaker: null, gap: freeze({ type: "attribution_unwitnessed", detail: "no admitted referent stands beside a verb at either boundary of this quotation — the line is unowned, which is a result, not a failure" }) });
}

/**
 * The outer narration frames: who is "I" across a stretch of unquoted prose.
 *
 * P3, verbatim: priors are injected, never derived. Without a frame prior
 * this returns the typed gap and NOTHING ELSE — no heading heuristic, no
 * first-person-pronoun vote, no "probably the protagonist". Which human
 * wrote a novel's narration down as frames is exactly the kind of received
 * knowledge the coref prior already is in this repo (pg84-frankenstein
 * .coref.json), and it enters the same way, with its giver named.
 */
export function narrationFrames(text, { framePrior = null, offset = 0 } = {}) {
  if (!framePrior) {
    return freeze({
      schema: "EONarrationFrames@1",
      frames: freeze([]),
      gap: freeze({ type: "frame_prior_absent", detail: "who narrates an unquoted stretch is not readable from punctuation; no narratorSpans prior was injected (P3: never patch a missing prior by loosening a gate)" }),
    });
  }
  // The prior's own shape: anchors, not offsets, so the curation survives a
  // re-encoded or re-paginated copy of the text. Resolving them is this
  // adapter's job (the anchor is prose; prose is the medium's business).
  const frames = [];
  const unresolved = [];
  for (const referent of framePrior.referents ?? []) {
    for (const span of referent.narratorSpans ?? []) {
      const from = span.fromAnchor ? text.indexOf(span.fromAnchor) : 0;
      const to = span.toAnchor ? text.indexOf(span.toAnchor) : text.length;
      // An anchor that does not resolve is REPORTED, never quietly widened
      // to the whole text — a frame with a guessed edge is a frame that
      // silently reassigns someone else's narration.
      if ((span.fromAnchor && from < 0) || (span.toAnchor && to < 0) || to <= from) {
        unresolved.push(freeze({ narrator: referent.id, span: freeze({ ...span }), reason: from < 0 ? "fromAnchor not found" : to < 0 ? "toAnchor not found" : "anchors resolve out of order" }));
        continue;
      }
      frames.push(freeze({ narrator: referent.id, byteStart: from + offset, byteEnd: to + offset, fromAnchor: span.fromAnchor ?? null, toAnchor: span.toAnchor ?? null }));
    }
  }
  frames.sort((a, b) => a.byteStart - b.byteStart);
  return freeze({
    schema: "EONarrationFrames@1",
    prior: freeze({ giver: framePrior.source ?? null, version: framePrior.coref_prior_version ?? null }),
    frames: freeze(frames),
    unresolvedAnchors: freeze(unresolved),
    narrators: freeze([...new Set(frames.map((f) => f.narrator))].sort()),
    gap: frames.length === 0 ? freeze({ type: "no_narrator_spans", detail: "the injected prior carries no narratorSpans — a coref prior is not automatically a frame prior" }) : null,
  });
}

/** Which frame a byte offset falls in — the "who is speaking here" question,
 * answered by containment rather than by proximity. Embedded (quoted) frames
 * win over outer ones: that is what embedding means. */
export function holderAt(byteOffset, { narration = null, embedded = [], embeddedSpeakers = new Map() } = {}) {
  for (const frame of embedded) {
    if (byteOffset >= frame.start && byteOffset < frame.end) {
      const speaker = embeddedSpeakers.get(frame.start) ?? null;
      return freeze({ holder: speaker, depth: 2, via: freeze([]), basis: speaker ? "embedded quotation frame" : "embedded quotation frame with no attributed speaker", gap: speaker ? null : "embedded_speaker_unattributed" });
    }
  }
  for (const frame of narration?.frames ?? []) {
    if (byteOffset >= frame.byteStart && byteOffset < frame.byteEnd) {
      return freeze({ holder: frame.narrator, depth: 1, via: freeze([]), basis: `narration frame ${frame.heading}`, gap: frame.narrator ? null : "unassigned_by_prior" });
    }
  }
  return freeze({ holder: null, depth: 0, via: freeze([]), basis: null, gap: "outside_every_known_frame" });
}
