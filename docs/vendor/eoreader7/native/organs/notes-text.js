// organs/notes-text.js — the TEXT face of the kernel's notes ledger.
//
// RENAMED 2026-09-08, FILE AND EVERY EXPORTED NAME, from hyperlexicon.js.
// This file's own first line has always denied being a Hyperlexicon — it
// is the text face of `kernel/notes.js`, subject/verb/object dressing over
// a medium-blind ledger. The name it carried was `kernel/hyperlexicon.js`'s
// (Xushen: an explicit ledger of relation-composition affordances, given by
// a named giver, never a vocabulary) — a real module, at a different path,
// answering a different question. Five eval scripts had already imported
// BOTH in one file and hand-aliased the collision away (`createChemistry`)
// rather than surface it; two more (`lib/full-circuit.mjs`,
// `lib/door-probe.mjs`'s callers) read as if this file WERE the affordance
// ledger to anyone who had not opened both. The rename removes the
// collision instead of asking every future reader to keep dodging it.
// `makeHyperlexicon` -> `makeNotesText`; the returned `createHyperlexicon`
// -> `createNotes`; `foldHyperlexicon` -> `foldNotes`; the returned
// `readingFromHyperlexicon` key is dropped in favour of passing the
// kernel's own `readingFromNotes` straight through, unrenamed. Every other
// name here (`hear`, `admit`, `assertionId`, `recipeId`, `REFUSALS`,
// `VERB_CLASS`, `foldWithStanding`, `foldCuts`, …) never carried the
// colliding word and is untouched. `kernel/hyperlexicon.js` itself is
// untouched — this rename is what settles which module owns the name.
//
// WHAT MOVED, AND WHERE (2026-09-02, user direction: "the hyperlexicon
// should be part of eoreader7, medium agnostic … the fold should only be an
// interaction surface"). The ledger itself — first sighting INS, re-sighting
// SYN, witnesses and spans unioned, the door with typed refusals, attest,
// concede, the fold, the frame, the stream — now lives in
// `kernel/notes.js` with ends called end1/label/end2 and NO grammar in it.
// This file is what a text reading needs on top: the subject/verb/object
// vocabulary its callers already speak (the-fold's holon.js, corroboration,
// derivation, nesting, kind-standing, predigest — the 221-site SVO wipe the
// fold's P76 names is not done, so this face keeps those names live), and
// the one gate that is a question about ENGLISH: is this connector a verb?
//
// THAT GATE IS ASYMMETRIC (P56): a part of speech is a candidate set, not a
// per-occurrence verdict, so an out-of-vocabulary connector is never
// refused and a settled non-verb is. It is INJECTED (`classifyConnector`),
// carries its own giver, and reaches the kernel as an ordinary gate — the
// kernel does not know the refusal is about grammar.
//
// THE API IS OTHERWISE BYTE-COMPATIBLE for every existing caller: the same
// shapes in and out (`hear` takes subject/verb/object, `foldNotes` returns
// them), the same task-log injection (`makeNotesText(taskLog)`). What is
// NEW rides beside: `createNotes({ frame })` declares what this reader
// stands on, `frameOf` reads it back, and `stream`/`figures`/`segment` read
// the ledger as the event stream it is. Notes on the log itself are stored
// under the NEUTRAL names (end1/label/end2); the SVO names are this face's
// projection, computed at fold time, never written twice.
//
// The specimen this ledger was built against (a real turn: "who was Queen
// Victoria's prime minister?" answered "Robert Peel" from a list of ten,
// because nothing accumulated and nothing was admitted) is in the kernel's
// lineage note and in notes-text.test.mjs, unchanged.
import { makeNotes, noteId, recipeId as kernelRecipeId, REFUSALS as NOTE_REFUSALS } from "../kernel/notes.js";
import { GRAMMAR_MIN_SHARE } from "../adapters/text/grain-typing.js";

/** The one identity for an assertion, so two sightings of it are one task. */
export const assertionId = (subject, verb, object) => noteId(subject, verb, object);

/** How this reader was configured — a content address over the caller's own descriptor (kernel/notes.js). */
export const recipeId = kernelRecipeId;

/**
 * Why an offered assertion was turned away. The kernel's two structural
 * reasons plus this face's one grammatical reason — a closed class.
 */
export const REFUSALS = Object.freeze({
  /** The connector settles, against a named prior, as something other than a verb. */
  NOT_A_VERB: "not_a_verb",
  INCOMPLETE: NOTE_REFUSALS.INCOMPLETE,
  UNADDRESSED: NOTE_REFUSALS.UNADDRESSED,
});

/**
 * The Thrax class an assertion's connector has to settle as, in the lens's
 * own vocabulary. A LITERAL THAT IS CHECKED: notes-text.test.mjs asserts
 * this string is actually in `wordclass.js::THRAX_MAP` rather than trusting
 * it — a capitalisation slip here fails silently in the safe-looking
 * direction (it did once: "Verb" refused nothing and admitted every
 * preposition).
 */
export const VERB_CLASS = "verb";

const toSVO = (n) => ({ ...n, subject: n.end1, verb: n.label, object: n.end2 });

export function makeNotesText(taskLog) {
  const { cellOf = null, noteIdentity = null, ...bundle } = taskLog;
  // The identity organ speaks SVO to its callers (P73's seam); the kernel
  // hears ends. Adapt at the face, once.
  const identity = noteIdentity
    ? (end1, label, end2) => { const c = noteIdentity(end1, label, end2); return c ? { end1: c.subject, label: c.verb, end2: c.object } : null; }
    : null;
  const notes = makeNotes({ taskLog: bundle, cellOf, identity });

  /** A fresh, empty notes log — with, when given, the frame its reader stands on. */
  const createNotes = (opts) => notes.createNotes(opts);

  function hear(log, { subject, verb, object, spans = [], witness = null, because = null, subjectFace = null, objectFace = null }) {
    return notes.hear(log, { end1: subject, label: verb, end2: object, spans, witness, because, end1Face: subjectFace, end2Face: objectFace });
  }

  /**
   * admit(log, edges, {classifyConnector, minShare, witness}) — the door.
   * The connector question becomes the kernel's injected gate; everything
   * else (incomplete, unaddressed, the accumulated log returned first) is
   * the kernel's own.
   */
  function admit(log, edges, { classifyConnector = null, minShare = GRAMMAR_MIN_SHARE, witness = null } = {}) {
    const originals = new Map();
    const arrangements = (edges ?? []).map((e) => {
      const a = {
        end1: e?.subject, label: e?.verb, end2: e?.object,
        // A negated edge is a CUT (S69), not a link with a sign: the door
        // reads polarity "-" here and nowhere else.
        polarity: e?.polarity === "-" ? "-" : "+",
        // The denying bytes, for a cut: this face reads the span's text; the
        // kernel carries it as the contest's `because`.
        ...(e?.polarity === "-" ? { decider: String((e?.spans ?? []).map((s) => s?.text).find(Boolean) ?? "").replace(/\s+/g, " ").trim() || null } : {}),
        // A text span's face is its bytes, whitespace-folded; a span with no
        // bytes behind it is not an address for this face's purposes.
        spans: (e?.spans ?? []).map((s) => ({ ...s, text: String(s?.text ?? "").replace(/\s+/g, " ").trim() })).filter((s) => s.text),
        end1Face: e?.end1Face ?? null, end2Face: e?.end2Face ?? null,
      };
      originals.set(a, e);
      return a;
    });
    const gate = classifyConnector
      ? ({ label }) => {
        const c = classifyConnector({ verb: label }, { minShare });
        return c?.settled && c.thraxClass && c.thraxClass !== VERB_CLASS
          ? { reason: REFUSALS.NOT_A_VERB, detail: `"${label}" settles as ${c.thraxClass}`, givers: c.givers ?? null }
          : null;
      }
      : null;
    const r = notes.admit(log, arrangements, { gate, witness });
    return {
      log: r.log,
      heard: r.heard.map((h) => ({ id: h.id, subject: h.end1, verb: h.label, object: h.end2, ...(h.cut ? { cut: true } : {}) })),
      contests: r.contests ?? [],
      rezeroed: r.rezeroed ?? [],
      turnedAway: r.turnedAway.map((t) => ({ edge: originals.get(t.arrangement) ?? t.arrangement, reason: t.reason, detail: t.detail, ...(t.givers !== undefined ? { givers: t.givers } : {}) })),
    };
  }

  /** The reading, projected — every live assertion, most-witnessed first, in this face's names beside the neutral ones. */
  const foldNotes = (log) => notes.fold(log).map(toSVO);
  /** The reading with each note's STANDING beside it (kernel standingOf: sources, instruments, kinds, standing) — what a consumer that decides on standing reads, so it never recomputes one. */
  const foldWithStanding = (log) => notes.foldWithStanding(log).map((n) => ({ ...toSVO(n), sources: n.sources, instruments: n.instruments, undeclared: n.undeclared, standing: n.standing, kinds: n.kinds }));

  const concededNotes = (log) => notes.concededNotes(log).map(toSVO);
  /** The cuts — every live denial, in this face's names, apart from the links (S69). */
  const foldCuts = (log) => notes.foldCuts(log).map(toSVO);

  return {
    createNotes, hear, attest: notes.attest, admit, concede: notes.concede, concededNotes, concededIds: notes.concededIds,
    // The contest half of the record (kernel CON·Figure·CONTESTED). `attest`
    // lands agreement, `dispute` lands disagreement, `concede` lands
    // retraction — and only the third one withdraws anything.
    dispute: notes.dispute, settleDispute: notes.settleDispute, disputesOf: notes.disputesOf,
    disputedIds: notes.disputedIds, disputeHistory: notes.disputeHistory, DISPUTE_OUTCOMES: notes.DISPUTE_OUTCOMES,
    DISPUTE_KINDS: notes.DISPUTE_KINDS, NEEDS_THIRD_SOURCE: notes.NEEDS_THIRD_SOURCE,
    foldNotes, foldWithStanding, standingOf: notes.standingOf, readingFromNotes: notes.readingFromNotes,
    frameOf: notes.frameOf, frames: notes.frames, redeclareFrame: notes.redeclareFrame,
    stream: notes.stream, figures: notes.figures, segment: notes.segment,
    dietBoundaries: notes.dietBoundaries, concedeDiet: notes.concedeDiet,
    assertionId, recipeId, REFUSALS, foldCuts, negationTimeline: notes.negationTimeline, isCutId: notes.isCutId, CUT_PREFIX: notes.CUT_PREFIX,
    declareVoid: (log, v) => notes.declareVoid(log, { end1: v.end1 ?? v.subject, label: v.label ?? v.verb, end2: v.end2 ?? v.object ?? null, scope: v.scope, because: v.because ?? null }),
    foldVoids: (log) => notes.foldVoids(log).map(toSVO), voidTimeline: notes.voidTimeline, rezeroVoid: notes.rezeroVoid, fillingsSince: notes.fillingsSince, isVoidId: notes.isVoidId, VOID_PREFIX: notes.VOID_PREFIX,
  };
}
