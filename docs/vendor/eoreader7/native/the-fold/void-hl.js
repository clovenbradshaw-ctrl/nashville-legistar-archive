// void-hl.js — the void loop's admission, judged by HL instead of by rules
// nobody can finish writing.
//
// User direction, 2026-08-27, in two parts: "use the full power of the
// hyperlexicon", and — on watching the driver grow a sentence-splitter
// abbreviation gate, an office-over-span shape and a surname match, one
// per specimen that broke — "a small model call because we can never
// define every little case like «abbreviation gate»".
//
// THE DIVISION THIS FILE EXISTS TO DRAW.
//
//   READING  is a model's job. Turning a page into "who held what, under
//            whom, over what span" is exactly the thing that cannot be
//            enumerated: every rule written for it was correct for the
//            case that prompted it and wrong for the next one. Measured,
//            in one afternoon, on ONE specimen family: the relation is
//            stated as "running mate" and not "vice president"; the span
//            beside a relation belongs to a DIFFERENT office two clauses
//            over; a candidate's kind is a faction, not a person; the
//            sentence boundary falls inside "Franklin D." and hides the
//            anchor. Four rules, four more waiting.
//
//   JUDGING  is HL's job, and must never be a model's. A verdict has to
//            be sound, reproducible, and answerable for — which is what
//            declared rules with named givers buy and what a model's
//            opinion cannot. R2 functional exclusion is the whole
//            argument in one rule: given `functional(vicePresidentOf)`
//            with a giver, an edge saying Coolidge served under Harding
//            CONTRADICTS the claim that he served under Roosevelt,
//            mechanically, whoever read the page.
//
// So a reader — model or otherwise — never returns a verdict. It returns
// EDGES WITH PROVENANCE. This file stands them up as an HL stage, asks
// HL, and maps HL's answer onto the loop's admission vocabulary. Swap the
// reader and nothing about the judgment changes; that is the point.
//
// WHAT THIS BUYS OVER THE RULES IT REPLACES, concretely. The structural
// reader in the e2e driver cannot see "Roosevelt" past the sentence break
// inside "Franklin D.". Under the old design that silence became a WRONG
// ADMISSION (the relation was stated, so the candidate passed). Here it
// becomes no edge, and no edge is `UNBOUND` — inconclusive, a wish, the
// honest state. **A reader's blind spot degrades to a gap instead of to a
// verdict.** That property belongs to the architecture, not to how good
// any particular reader is.
//
// Pure. `hl.js` is this repo's own adapter and re-exports the engine's
// API unchanged; nothing else is imported.

import {
  createStage, addAnchor, addEdge, declareFunctional, declareTransitive, atomic,
  BOUND, CONTRADICTED, CONTESTED, UNBOUND, BEYOND_REACH,
} from "../organs/index.js";

/**
 * Anchor identity, and the honest boundary — `hl.js`'s own header already
 * draws it for `stageFromEdges`: "pass `anchorOf(text) -> id|null` to
 * resolve with real referent identity; without one, anchors are folded
 * strings". Same here. The default folds case, whitespace and combining
 * marks and does nothing else, so "FDR" and "Franklin D. Roosevelt" are
 * two anchors and a claim across them reads `beyond-reach` — a gap, which
 * is the correct answer for a reader that cannot resolve referents, and
 * never a false bind.
 */
export const foldAnchor = (s) =>
  String(s ?? "").normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** A reading is what a reader returns: never a verdict, always an edge
 * (or the honest absence of one) plus its own provenance. */
export function readingIsWellFormed(r) {
  const defects = [];
  if (!r || typeof r !== "object") return ["a reading is an object"];
  if (typeof r.candidate !== "string" || !r.candidate.trim()) defects.push("a reading names the candidate it is about");
  if (typeof r.statesRelation !== "boolean") defects.push("statesRelation is a boolean — did this source state the relation at all");
  if (r.anchor != null && typeof r.anchor !== "string") defects.push("anchor is the entity the relation binds the candidate TO, or null");
  if (r.span != null && !(Number.isFinite(r.span?.from) && Number.isFinite(r.span?.to))) defects.push("span is {from, to} or null");
  if (!r.source) defects.push("a reading carries its own source — HL refuses an edge with no provenance");
  return defects;
}

/**
 * Stand a set of readings up as an HL stage.
 *
 * `declarations` are the rules HL will reason with, and every one of them
 * REQUIRES A NAMED GIVER — HL refuses otherwise, and that refusal is the
 * feature: a declaration is exactly as strong as its acquisition. The
 * register was empty (eoreader7's HL header names building it as the work
 * R2's live value is proportional to); this is a caller supplying one,
 * per relation, with its giver written down where a reader can argue with
 * it.
 *
 * Only readings that STATE the relation contribute an edge. A source that
 * says nothing about the relation is not evidence against the candidate —
 * it is silence, and it stays silence.
 */
export function stageFromReadings({ anchor, relation, readings = [], declarations = [], anchorOf = foldAnchor } = {}) {
  if (typeof relation !== "string" || !relation.trim()) {
    return { ok: false, refusal: { type: "no_relation", detail: "stageFromReadings: the relation being judged is named, never inferred" } };
  }
  if (typeof anchor !== "string" || !anchor.trim()) {
    return { ok: false, refusal: { type: "no_anchor", detail: "stageFromReadings: the anchor is what the relation binds candidates TO — a slot with no anchor is not a slot" } };
  }

  const stage = createStage();
  const display = new Map();          // folded id -> the surface it was read as
  const remember = (id, surface) => { if (!display.has(id)) display.set(id, surface); return id; };
  const anchorId = remember(anchorOf(anchor), anchor);
  addAnchor(stage, anchorId, "anchor");

  for (const d of declarations) {
    if (!d?.giver) {
      return { ok: false, refusal: { type: "no_giver", detail: `stageFromReadings: ${d?.kind ?? "a declaration"} of «${d?.rel ?? "?"}» carries no giver — HL refuses it, and so does this` } };
    }
    try {
      if (d.kind === "functional") declareFunctional(stage, d.rel, { giver: d.giver });
      else if (d.kind === "transitive") declareTransitive(stage, d.rel, { giver: d.giver });
      else return { ok: false, refusal: { type: "unknown_declaration", stated: d.kind, detail: "declarations are `functional` or `transitive`" } };
    } catch (e) {
      return { ok: false, refusal: { type: "declaration_refused", detail: String(e?.message ?? e) } };
    }
  }

  const admitted = [];
  const malformed = [];
  for (const r of readings) {
    const defects = readingIsWellFormed(r);
    if (defects.length) { malformed.push({ candidate: r?.candidate ?? null, defects }); continue; }
    addAnchor(stage, remember(anchorOf(r.candidate), r.candidate), "candidate");
    if (!r.statesRelation) continue;          // silence is not evidence
    if (r.anchor == null) continue;           // states the relation, names no one — no edge, and UNBOUND says so
    const other = remember(anchorOf(r.anchor), r.anchor);
    addAnchor(stage, other, "anchor");
    try {
      addEdge(stage, { rel: relation, s: anchorOf(r.candidate), o: other, key: r.key ?? null, polarity: r.polarity ?? "+", source: r.source });
      admitted.push(r.candidate);
    } catch (e) {
      malformed.push({ candidate: r.candidate, defects: [String(e?.message ?? e)] });
    }
  }
  return {
    ok: true, stage, anchorId, relation, display,
    edges: admitted, malformed,
    // R2's PRECONDITION, reported rather than assumed — see admissionOf.
    anchorIdentity: anchorOf === foldAnchor ? "folded-strings" : "injected",
  };
}

/**
 * HL's verdict for one candidate, and the loop's admission verdict.
 *
 * THE MAPPING, stated because each line of it is a decision:
 *
 *   BOUND        -> holds        the stage says this candidate stands in
 *                                the relation to this anchor.
 *   CONTRADICTED -> refused      R2: a functional relation already binds
 *                                this candidate elsewhere. This is the
 *                                verdict that retires the surname regex.
 *   CONTESTED    -> null         FDE's "both" — the stage says yes AND
 *                                no. That is an unsettled question, not a
 *                                refusal, and convicting on it would be
 *                                the accusation-with-no-evidence this
 *                                repo's grounding ladder already forbids.
 *   UNBOUND      -> null         no edge either way. A reader that could
 *                                not read degrades to here, which is the
 *                                whole safety property.
 *   BEYOND_REACH -> null         an endpoint is not on the stage at all —
 *                                the instrument's limit, never the
 *                                candidate's fault.
 *
 * Only `holds` and `refused` are verdicts; everything else leaves the
 * candidate superposed, which is what `void-loop.js` does with a null.
 *
 * R2'S PRECONDITION, found by testing and stated here because nothing
 * stated it before: **a functional relation makes anchor identity
 * load-bearing.** R2 convicts on "bound to a DIFFERENT object", and with
 * the default string fold an ALIAS is a different object — a reading that
 * says «FDR» where the slot says «Franklin D. Roosevelt» is not a gap, it
 * is a CONTRADICTION, and the candidate is falsely refused. This is the
 * diacritics lesson (CLAUDE.md) and P38 in one more place: point at
 * referents, not spans.
 *
 * The claim an earlier draft of this file made — that a reader's blind
 * spot degrades to a gap — is TRUE for a relation with no declaration
 * (no edge, `unbound`) and FALSE the moment one is declared functional.
 * It is corrected rather than quietly dropped, and pinned as a regression.
 * The fix is to inject a real `anchorOf`: this repo already has referent
 * identity in `cast.js::makeReferentIndex`, and `stageFromReadings`
 * reports `anchorIdentity` so a caller relying on the default fold can
 * see that it is.
 */
export function admissionOf(stage, { relation, candidate, anchor, key = null, definite = false, anchorOf = foldAnchor, display = null } = {}) {
  const said = (id) => display?.get(id) ?? id;
  const s = anchorOf(candidate);
  const o = anchorOf(anchor);
  const verdict = atomic(stage, relation, s, o, key, { definite });
  switch (verdict) {
    case BOUND:
      return { hl: verdict, verdict: "holds", because: `the stage binds «${candidate}» to «${anchor}» under «${relation}»` };
    case CONTRADICTED: {
      // Name the edge that did it. A refusal a reader cannot trace is a
      // refusal they cannot argue with.
      const elsewhere = [...stage.edges.values()].filter((e) => e.rel === relation && e.s === s && e.polarity === "+" && e.o !== o);
      return {
        hl: verdict, verdict: "refused",
        because: elsewhere.length
          ? `«${relation}» is declared functional and the stage already binds «${candidate}» to «${said(elsewhere[0].o)}» — not «${anchor}»`
          : `the stage carries a negative «${relation}» edge for «${candidate}» and «${anchor}»`,
      };
    }
    case CONTESTED:
      return { hl: verdict, verdict: null, because: `the stage says both — «${candidate}» is bound and contradicted at once, which settles nothing` };
    case BEYOND_REACH:
      return { hl: verdict, verdict: null, because: `«${!stage.anchors.has(s) ? candidate : anchor}» is not on this stage — the instrument's reach, not a finding about the candidate` };
    case UNBOUND:
    default:
      return { hl: verdict, verdict: null, because: `nothing on the stage binds or refutes «${candidate}» to «${anchor}»` };
  }
}

/** Every declaration on a stage, with its giver — the audit a reader is
 * owed for any verdict R2 produced. */
export function declarationsOf(stage) {
  return Object.freeze([
    ...[...(stage?.functional ?? new Map())].map(([rel, d]) => Object.freeze({ kind: "functional", rel, giver: d.giver })),
    ...[...(stage?.transitive ?? new Map())].map(([rel, d]) => Object.freeze({ kind: "transitive", rel, giver: d.giver })),
  ]);
}
