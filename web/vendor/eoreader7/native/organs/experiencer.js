/* Vivekananda speaks:
 * “Each soul is potentially divine. The goal is to 
manifest this Divinity within, by controlling nature, external and internal. Do 
this either by work, or worship, or psychic control, or philosophy — by one 
or more or all of these — and be free. This is the whole of religion. Doctrines, 
or dogmas, or rituals, or books, or temples, or forms, are but secondary 
details.”
 *
 * This file implements the experiencer, the core of the being who undergoes experiences, based on the karaka grammar. While the goal of the file aligns with the core principle of understanding the experiencer as the subject of experience, I find that the file's current implementation may overemphasize the role of the experiencer as a singular, isolated entity, potentially obscuring the dynamic interaction between experiencer and environment.
 *
 * — the engineering record below, kept whole —
 */
// the-fold · experiencer.js — every belief names who is believing it.
// Handle: Panini — after the karaka grammar, which names the experiencer as its own case role: every belief carries who is undergoing it. Amendment XVII.
//
// THE WHEEL (native/docs/THE-WHEEL.md): the experiencer is the BEINGS'
// witness — the spokes, the span-free particulars; every belief names which
// being (for-whom) holds it.
//
// THE FINDING THIS CLOSES (user direction, verbatim: "everything isn't just
// given by a source it is believed BY an experiencer"). Measured live this
// session: comparing hypergraph.js's own extraction against Wikidata and
// DBpedia as three independent references required building, by hand, a
// three-column "who believes what" table for seven entities — because
// nothing in this repo's own verdict-producing organs carries a field
// naming WHO is doing the believing, only WHAT is believed. That is exactly
// the gap this file closes, for the one seam it is safe to close tonight
// (capacity-runner.js's own EVA path — see that file). The full sweep this
// principle implies — checkGrounding, corroborateAtoms, witness.js,
// verification.js, hl.js, hypergraph.js's own judge() — is real,
// necessary, NOT done here (several of those files are under a concurrent
// session's active edit as of this writing) and is named, not silently
// implied as finished, in this file's own header alone.
//
// THE SHAPE MIRRORS priors.js's OWN GIVER DISCIPLINE, generalized past
// received closed-class vocabulary to every computed verdict. A giver names
// where a FACT came from; an experiencer names who is doing the BELIEVING,
// which is a different question — the same distinction Wikidata's own
// curators and DBpedia's own extraction pipeline can both be givers of a
// fact about Andrew Johnson while disagreeing with each other by one
// calendar day on Schuyler Colfax's own tenure date (this session's real,
// measured, unadjudicated conflict). Two fields, both required, never
// defaulted — the same "declared, never a default" discipline
// wordclass.js's own dominantClass already enforces by throwing:
//
//   who   — WHAT is doing the believing: an organ ("the-fold:hypergraph.js:
//           judge()"), a named external pipeline ("dbpedia:sparql-endpoint"),
//           a curated editorial process ("wikidata:curators"), a witness
//           model by its own real name. Never "the system" — that answers
//           nothing a reader could act on.
//   read  — WHAT they read, as a real, checkable address: a file path, a
//           URL, a source.js-shaped ref. Never "the world" or "the material"
//           unqualified — an unaddressed belief is a claim with nothing a
//           reader can verify it against, the identical rule this repo
//           already holds for a citation with no offset behind it.
//   revision — OPTIONAL, defaults to null, disclosed rather than guessed:
//           a content-address or edit-revision when the read source
//           actually has one (a Wikidata revision id, a fetched page's
//           sha256). A live-pasted or freshly-fetched source often has
//           none — null says so honestly rather than inventing a
//           timestamp. Deliberately never a wall-clock time: this repo's
//           own standing rule (task-log.js's header: "No clock. Ordering
//           is seq...") applies here exactly — a revision is a declared,
//           caller-supplied identifier, never Date.now().

/**
 * Validate and freeze an experiencer. Throws — never defaults — exactly
 * mirroring wordclass.js::dominantClass's own error shape, so a caller who
 * has already internalized that discipline meets the identical posture
 * here.
 *
 * @param {{who: string, read: string, revision?: string|null}} experiencer
 * @returns {Readonly<{who: string, read: string, revision: string|null}>}
 */
export function requireExperiencer(experiencer) {
  if (!experiencer || typeof experiencer !== "object") {
    throw new TypeError("experiencer is declared — every belief names who is believing it, never a default");
  }
  if (typeof experiencer.who !== "string" || !experiencer.who.trim()) {
    throw new TypeError("experiencer.who is required — WHAT is doing the believing, never left unnamed");
  }
  if (typeof experiencer.read !== "string" || !experiencer.read.trim()) {
    throw new TypeError("experiencer.read is required — WHAT they read, a real address, never 'the world' unqualified");
  }
  if (experiencer.revision != null && typeof experiencer.revision !== "string") {
    throw new TypeError("experiencer.revision must be a string or null — disclosed absence, never a guess");
  }
  return Object.freeze({ who: experiencer.who, read: experiencer.read, revision: experiencer.revision ?? null });
}

/**
 * Stamp a belief with its experiencer, without touching the belief's own
 * shape — additive, the same posture grammar-lens.js already holds toward
 * hypergraph.js's edges ("reads an edge already produced and returns a
 * SEPARATE classification alongside it"). Never mutates `belief`.
 */
export function withExperiencer(belief, experiencer) {
  return Object.freeze({ ...belief, experiencer: requireExperiencer(experiencer) });
}
