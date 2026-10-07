// tacit-corroboration.js — beings admitted by corroborated recurrence, not
// by a received prior's say-so and not by a golden. Archon: polanyi
// (organs/archon-compendium.js) — "expertise built from corroborated
// encounter, revisable... we know more than we can state outright."
//
// THE INVERSION FROM nominal-beings.js/greek.mjs::greekBeings. Both of
// those REQUIRE the received prior to already classify a form NOUN/PROPN
// (English) or require an article immediately before it (Greek) — a HARD
// GATE. Measured this session, twice, on real primary text: neither gate
// admits a play's own title character. Doctor Faustus is unattested in
// pos-prior-eng.json despite 407 raw occurrences (the single most-said word
// in the whole play); Κρέων/Ἀντιγόνη are unattested in pos-grc.json AND
// never once preceded by an article in the running dialogue (12 raw
// occurrences checked directly, zero article-adjacent). Both gates ask
// "can I NAME what kind of word this is" before admitting it. A reader who
// has never seen a word still notices it keeps coming back — that noticing
// is prior to naming, and it is what this file admits on.
//
// THE MECHANISM IS NOT NEW. kernel/corroboration.js already runs a
// domain-blind SIG (sign provisional) -> CON (count distinct sources) ->
// confirm pipeline, extracted because organs/mnemonic.js (vision),
// the-fold/expertise.js (a learned form's shape) and the-fold/kind-memory.js
// each reached for it independently. This file is corroboration.js's FOURTH
// application: the "concept" is a recurring text form, and a "source" is
// either a distinct position within one text (a genuinely separated
// sighting, never a burst of adjacent repeats) or a distinct DOCUMENT when
// several real witnesses of the same work are read together — the second
// mode is corroboration.js's own original intent (distinct sources
// corroborating a kind), used here across real translations of the same
// play rather than across photographs of the same face.
//
// THE PRIOR'S ROLE IS INVERTED, DISCLOSED. nominal-beings.js requires
// attestation to ADMIT. Here the prior (when one is given) is consulted
// only to EXCLUDE: a form the prior confidently classifies as a CLOSED
// grammatical class (determiner, adposition, conjunction, pronoun,
// auxiliary, particle) is dropped, because closed classes are small,
// stable, and reliably attested in any reasonably-sized prior — excluding
// on POSITIVE closed-class evidence is safe. A form the prior has never
// seen, or classifies as an open class, SURVIVES — that is deliberate: an
// unattested recurring form is exactly the "high possibility" case
// kernel/corroboration.js's own SIG comment names, and refusing it here
// would reproduce the exact gap this file exists to close.
//
// WHAT THIS DOES NOT DO. It does not fold surface variants by inflection
// the way discoverNominalBeings's stem grouping does — V1 groups by exact
// case-folded form only (still catches FAUSTUS/Faustus/faustus, since
// tokenize already lowercases); a genitive "Faustus'" or a declined Greek
// case form is a DIFFERENT exact form and corroborates separately unless
// the caller pre-folds. Named here as real, disclosed scope, not silently
// assumed solved by nominal-beings.js's stem-grouping machinery, which
// this file could layer on top of later but does not yet.
//
// MEASURED AGAINST WILSON'S NULL (2026-09-23). A word-shuffle of the same
// text (null-arm.mjs's null) keeps every form's frequency, so raw
// recurrence fires almost as hard on structureless noise as on the play:
// it is salience (SIG·Pattern), not evidence that a form names an
// individual. Only what shuffling destroys — burstiness, determiner frame,
// position — carries structure. Faustus ranks first here because it is
// the most-said word, not because anything here knows it is a name; the
// licensed Entity/Kind decision is adapters/text/existence-grain.js.

import { tokenize, nominalClass } from "./nominal-beings.js";
import { signProvisionalKind, corroboration, confirmKind, CANONICALIZATION_FLOOR } from "../../kernel/corroboration.js";

// Closed classes the prior may EXCLUDE on — never an inclusion requirement.
// heard-surfaces.js's NAMING_CLASSES stays the inclusion signal elsewhere;
// this is deliberately the complementary, narrower EXCLUSION signal.
const CLOSED_CLASSES = Object.freeze(new Set(["DET", "ADP", "CCONJ", "SCONJ", "PRON", "AUX", "PART"]));

/**
 * withinTextSightings(text, {minSeparation}) — reduce a form's raw token
 * occurrences to distinct SIGHTINGS: the first occurrence is always a
 * sighting; a later occurrence is a new sighting only if it falls at least
 * `minSeparation` characters past the last ACCEPTED sighting. A burst of
 * adjacent repeats (a duplicated line, a stutter, an OCR glitch) collapses
 * to one sighting rather than inflating corroboration; sightings spread
 * genuinely across the text each count. Returns Map<form, [{start,end}]>.
 */
export function withinTextSightings(text, { minSeparation = 200 } = {}) {
  const byForm = new Map();
  for (const t of tokenize(text)) {
    if (!byForm.has(t.w)) byForm.set(t.w, []);
    byForm.get(t.w).push({ start: t.start, end: t.end });
  }
  const sightings = new Map();
  for (const [form, occs] of byForm) {
    occs.sort((a, b) => a.start - b.start);
    const accepted = [occs[0]];
    for (const o of occs.slice(1)) {
      if (o.start - accepted[accepted.length - 1].start >= minSeparation) accepted.push(o);
    }
    sightings.set(form, accepted);
  }
  return sightings;
}

/**
 * discoverCorroboratedBeings(text, {prior, minSeparation, floor}) — THE
 * WITHIN-TEXT MODE. Every recurring form (any form with >=2 sightings by
 * withinTextSightings) is signed into a fresh corroboration.js store, one
 * sighting = one distinct `source`; a form clears CANONICALIZATION_FLOOR
 * (or the caller's own `floor`) the same way any other corroboration.js
 * concept does. A prior is optional — omit it and every recurring form is
 * judged purely by recurrence shape; pass one and closed-class forms are
 * excluded. Returns beings sorted by corroboration (not raw occurrence
 * count — a burst of 50 adjacent repeats is 1 corroboration, not 50).
 */
export function discoverCorroboratedBeings(text, { prior = null, minSeparation = 200, minShare, floor = CANONICALIZATION_FLOOR } = {}) {
  const sightings = withinTextSightings(text, { minSeparation });
  const store = { concepts: {} };
  const attested = new Map();
  for (const [form, sights] of sightings) {
    if (sights.length < 2) continue;
    const cls = prior ? nominalClass(form, prior, { minShare }) : null;
    if (cls && CLOSED_CLASSES.has(cls)) continue;
    attested.set(form, cls);
    for (const s of sights) signProvisionalKind(store, { name: form, source: `pos:${s.start}`, region: s, at: s.start });
  }
  const out = [];
  for (const form of Object.keys(store.concepts)) {
    confirmKind(store, form);
    const entry = store.concepts[form];
    if (corroboration(store, form) < floor) continue;
    out.push({ form, status: entry.status, corroboration: corroboration(store, form), sightings: sightings.get(form).length, attestedClass: attested.get(form) ?? null, at: entry.occurrences[0]?.region ?? null });
  }
  return out.sort((a, b) => b.corroboration - a.corroboration || b.sightings - a.sightings);
}

/**
 * discoverCrossSourceBeings(sources, {prior, minShare, floor}) — THE
 * CROSS-SOURCE MODE, corroboration.js's own original design used as
 * intended: `sources` is [{id, text}], each a REAL, DISTINCT document (a
 * different edition, a different translation, a different language) —
 * never positions within one text. A form's corroboration count is the
 * number of DIFFERENT sources' `id`s it was sighted in at least once —
 * `corroboration()` counts distinct `source` values, so this is not a
 * separate count, it is the same corroboration.js mechanism at the
 * document grain instead of the position grain. A proper name that is
 * preserved rather than translated (a real, common fact about how
 * translation handles personal names) corroborates across languages this
 * way without any single language's prior ever attesting it.
 */
export function discoverCrossSourceBeings(sources, { prior = null, minSeparation = 200, minShare, floor = CANONICALIZATION_FLOOR } = {}) {
  const store = { concepts: {} };
  const attested = new Map();
  const perSourceForms = new Map();
  for (const src of sources) {
    const sights = withinTextSightings(src.text, { minSeparation });
    const forms = new Set();
    for (const [form, occs] of sights) {
      const cls = prior ? nominalClass(form, prior, { minShare }) : null;
      if (cls && CLOSED_CLASSES.has(cls)) continue;
      if (!attested.has(form)) attested.set(form, cls);
      forms.add(form);
      signProvisionalKind(store, { name: form, source: src.id, region: occs[0], at: occs[0].start });
    }
    perSourceForms.set(src.id, forms);
  }
  const out = [];
  for (const form of Object.keys(store.concepts)) {
    confirmKind(store, form);
    const entry = store.concepts[form];
    const c = corroboration(store, form);
    if (c < floor) continue;
    const inSources = [...perSourceForms.entries()].filter(([, forms]) => forms.has(form)).map(([id]) => id);
    out.push({ form, status: entry.status, corroboration: c, sources: inSources, attestedClass: attested.get(form) ?? null });
  }
  return out.sort((a, b) => b.corroboration - a.corroboration);
}
