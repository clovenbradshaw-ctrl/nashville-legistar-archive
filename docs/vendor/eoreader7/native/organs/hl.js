// the-fold · hl.js — the adapter, and only the adapter.
//
// MOVED 2026-08-20: the logic itself (Stage, declarations, R1-R6, the
// verdict lattice, attach/sensitivity) now lives in
// eoreader7/native/interpretation/hl.js — it is Interpretation-
// domain engine infrastructure, not a the-fold concern, on the same
// evidence Article I.2 asks for any promotion (does it work identically
// regardless of content — proven with a non-linguistic omnimodal fixture
// in the engine's own test file) plus a placement finding specific to
// this move: `operators.js`'s ORGANS table, audited by domain, shows
// Interpretation as the most fragmented domain in the whole registry (29
// of 62 organs, nine separate hand-rolled EVA-Pattern checkers) with no
// shared judgment engine underneath any of them. HL is that engine,
// landed where the gap already was. Full account: the legacy engine.1/CLAUDE.md,
// "HL — the logic over hypergraph stages."
//
// What's left here is exactly what's the-fold's to own: turning THIS
// repo's own hypergraph.js edges into a stage. Re-exports the engine's
// full API so existing imports of "./hl.js" keep working unchanged.

export {
  BOUND,
  CONTRADICTED,
  CONTESTED,
  UNBOUND,
  BEYOND_REACH,
  UNREFUTED,
  UNDETERMINED,
  flip,
  createStage,
  addAnchor,
  addEdge,
  declareFunctional,
  declareTransitive,
  declareComplete,
  extendStage,
  atomic,
  read,
  attach,
} from "../interpretation/hl.js";

import { createStage, addAnchor, addEdge } from "../interpretation/hl.js";

// ── the adapter: hypergraph.js's public edges → a stage ────────────────
//
// Consumes the REAL public edge face ({subject, verb, object, polarity,
// refs, ...}) exactly as report.edges leaves makeRelationReader. Anchor
// identity is the honest boundary: pass `anchorOf(text) -> id|null` to
// resolve with real referent identity (a caller near the reader's own
// endpoint() can); without one, anchors are folded strings and the stage
// says so (`anchorKind: "folded-string"`). Never both silently — the
// P11 boundary ("the same name" and "the same recurring word" are never
// the same claim) carried into the adapter rather than blurred by it.
//
// DELIBERATELY DUMB ABOUT GRAMMAR. This adapter does not parse, does not
// second-guess subject/verb/object roles, and does not try to resolve
// paraphrase or orientation — it takes whatever edges the relation
// reader already decided are edges and turns them into stage material.
// Grammar (the grammar lens, SVO extraction, verb-form matching) is a
// LAYER that produced those edges upstream, or that reads them back as a
// disclosure downstream (grammar-lens.js's own mismatchedConnectors) —
// it is never something this adapter, or anything built on top of it,
// should re-derive or hand-tune to fix one specimen at a time. The
// structure is the edges; grammar is a lens on the structure, not the
// structure itself. (Named explicitly here because a concurrent
// session's live "chase" work hit exactly the failure this warns
// against: hand-tuning subject/verb/object per specimen regressed one
// case for every one it fixed — the same paraphrase-intolerance ceiling
// MINE-1's own eleven passes already found and disclosed. hl-acquire.js
// is built to the opposite discipline: count structure, never parse
// harder.)

const foldAnchor = (text) =>
  String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export function stageFromEdges(edges, { anchorOf = null } = {}) {
  const stage = createStage();
  stage.anchorKind = anchorOf ? "resolved-referent" : "folded-string";
  const anchor = (text) => {
    const resolved = anchorOf ? anchorOf(text) : null;
    return resolved ?? foldAnchor(text);
  };
  for (const e of edges ?? []) {
    if (!e || !(e.label ?? e.verb)) continue;
    const s = anchor((e.end1 ?? e.subject));
    const o = anchor((e.end2 ?? e.object));
    if (!s || !o) continue;
    addAnchor(stage, s);
    addAnchor(stage, o);
    addEdge(stage, {
      rel: foldAnchor((e.label ?? e.verb)),
      s,
      o,
      polarity: e.polarity === "-" ? "-" : "+",
      source: (e.refs && e.refs.length ? e.refs : ["unref'd edge"]).join(","),
    });
  }
  return stage;
}
