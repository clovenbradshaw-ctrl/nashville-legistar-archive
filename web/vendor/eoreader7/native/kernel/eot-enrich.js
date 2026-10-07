// Handle: Dignaga / Partee — a claim carries its warrant; tense points at a ground already established.
// kernel/eot-enrich.js — FIELDS THE ENGINE KNOWS THAT NO ONE LANGUAGE CAN SAY.
//
// The rich EOT record (kernel/eot-rich.js) carries everything a Universal
// Dependencies analysis states. Three fields a source sentence never states
// but the engine already computes, added here without a model call:
//
//   REFERENT   which being a content node names — not a string, a referent
//              id (organs/cast.js's makeReferentIndex, wrapped by
//              the-fold/referents.js's buildReferents, which this module
//              calls rather than re-implements). "The house of the king" and
//              "the king's house" resolve to the same referent for "king"
//              even though the words differ.
//   EVIDENCE   whether an arc is stated once or corroborated by a second,
//              independent source — organs/asserted.js's own standingOf,
//              the structural floor this repo already uses for verb claims,
//              applied here to whole arcs across documents. This is
//              grammaticalised in languages with an evidential mood (Turkish,
//              Quechua); English has no marker for it, so a plain English
//              sentence and its evidential status are two different pieces
//              of information English cannot merge into one word.
//   GROUND     the extent a statement is true of — its dates and places —
//              read off the CON·Ground markers the meaning layer already
//              typed (adpositions, and NUM/PROPN nodes they attach). Not
//              invented: every value is a byte span already in the record.
//
// Every function here is pure and takes records already built by
// kernel/eot-rich.js; nothing here parses text or calls a model.

export const ENOT_SCHEMA = "EOTEnrichment@1";

// ── REFERENT ─────────────────────────────────────────────────────────────
/**
 * attachReferentsToNodes(records, R) → the same records, each content node
 * additionally carrying `referent: id|null`. `R` is a resolver with the
 * shape `the-fold/referents.js`'s `buildReferents(ground)` returns
 * (`resolveName`, `represent`); passed in so this module never builds its
 * own copy of the referent organ.
 *
 * A node's lemma is resolved on its own first — the referent organ reads
 * names, and a bare lemma ("king") is exactly the form it expects. A node
 * whose lemma resolves to more than one being is left unresolved rather
 * than guessed: ambiguity is disclosed, not silently picked.
 */
export function attachReferentsToNodes(records, R) {
  if (!R) return records;
  for (const rec of records) {
    for (const n of rec.meaning.nodes) {
      const ids = R.resolveName(n.lemma) ?? new Set();
      n.referent = ids.size === 1 ? [...ids][0] : null;
      if (ids.size > 1) n.referentAmbiguous = [...ids];
    }
  }
  return records;
}

// ── EVIDENCE ─────────────────────────────────────────────────────────────
/**
 * A claim's identity for corroboration: the two ends' referent ids (or
 * lemmas, when a node has no referent) plus the relation's lemma-level
 * label. Referent-keyed where possible, so "the king's house fell" and
 * "the house of the king fell" are the SAME claim even though no word
 * matches — exactly the "point at a being, not a string" rule this
 * project already applies to prose.
 */
function claimKey(rec, arc) {
  const node = (key) => rec.meaning.nodes.find((n) => n.key === key);
  const end = (key) => { const n = node(key); return n ? (n.referent ?? `lemma:${n.lemma}`) : `key:${key}`; };
  return `${end(arc.from)}|${arc.rel.split(":")[0]}|${end(arc.to)}`;
}

/**
 * corroborate(records) → the same records, each arc additionally carrying
 * `standing: "single-witness"|"corroborated"` and `witnesses: [source, ...]`
 * — organs/asserted.js's own WITNESS_FLOOR (2), read across DOCUMENTS
 * (`rec.source`), never within one: two sentences of the same document
 * restating a claim are one witness re-testifying, not two.
 */
export function corroborate(records) {
  const bySource = new Map(); // claimKey -> Set(source)
  for (const rec of records) for (const a of rec.meaning.arcs) {
    const k = claimKey(rec, a);
    if (!bySource.has(k)) bySource.set(k, new Set());
    bySource.get(k).add(rec.source ?? "?");
  }
  for (const rec of records) for (const a of rec.meaning.arcs) {
    const witnesses = [...(bySource.get(claimKey(rec, a)) ?? [])];
    a.witnesses = witnesses;
    a.standing = witnesses.length >= 2 ? "corroborated" : "single-witness";
  }
  return records;
}

// ── GROUND: the extent a statement is true of ───────────────────────────
const DATE = /^(?:1[0-9]{3}|20[0-9]{2}|[0-9]{1,2})$/;
const MONTH = new Set(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]);

/**
 * groundOf(record) → { dates: [...], places: [...] } read off nodes the
 * meaning layer already marked. A date is a NUM node bonded to the clause
 * through a CON·Ground marker (a preposition: "in 1954", "on May 3") or a
 * bare four-digit NUM; a place is a PROPN node bonded the same way. Nothing
 * invented — every value is the node's own lemma, already in the record.
 */
export function groundOf(rec) {
  // THE EXTENT IS MARKED ON THE ARC, NOT ON THE MARKER (found live: the
  // preposition's own cell is CON·Pattern in every case, per
  // universal-grammar.js's relation table — it never reads CON·Ground. What
  // IS Ground-grain is the relation between the CLAUSE and its oblique
  // dependent: `obl` is SEG·Ground. A node the clause takes as a direct
  // ARGUMENT — "struck Nashville" — is syntactically a patient, not an
  // extent, however place-like the word is; only an oblique dependent is
  // read as the extent a statement is true of.
  const obliqueTargets = new Set(rec.meaning.arcs.filter((a) => a.cell === "SEG·Ground").map((a) => a.to));
  const dates = [], places = [];
  for (const n of rec.meaning.nodes) {
    const lemma = String(n.lemma ?? "").toLowerCase();
    if (n.upos === "NUM" && DATE.test(lemma) && (obliqueTargets.has(n.key) || /^(?:1[0-9]{3}|20[0-9]{2})$/.test(lemma))) dates.push(n.lemma);
    else if (MONTH.has(lemma)) dates.push(n.lemma);
    else if (n.upos === "PROPN" && obliqueTargets.has(n.key)) places.push(n.lemma);
  }
  return { dates, places };
}

/**
 * enrichRecords(records, { referents }) → records with nodes carrying
 * `.referent`, arcs carrying `.standing`/`.witnesses`, and each record
 * carrying `.ground`. The single entry point; the three passes above are
 * exported separately because a caller may want only one (the round-trip
 * tests use none of them — this module never changes what eot-rich.js
 * already proved).
 */
export function enrichRecords(records, { referents = null } = {}) {
  if (referents) attachReferentsToNodes(records, referents);
  corroborate(records);
  for (const rec of records) rec.ground = groundOf(rec);
  return records;
}
