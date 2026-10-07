// the-fold · hl-acquire.js — spin up hl.js declarations on demand,
// mechanically, from real material. The productionized version of the
// spin-up experiment (2026-08-20): compose organs this repo already
// owns (the relation reader, the grammar lens with the real UD
// treebank prior) into a refutation search over functional-hood, gated
// by an evidence floor, disclosed as a two-tier register, concession
// wired to a later stage's own counterexample.
//
// THE GRAIN-THEOREM CEILING, NOT A SOFT LIMIT. functional(r) is a
// Pattern-grain (∀-shaped) claim: "for all subjects, at most one
// object." By the same theorem probe D proved for the operator face —
// no upward entailment: a Pattern-grain claim is refutable from below
// but never earned from it — a corpus can only ever REFUTE
// functional-hood, never confirm it. So this module produces exactly
// two things, never a third: REFUTED (the corpus supplies its own
// counterexample — real, permanent, sound) and CANDIDATE
// (unrefuted-at-this-stage, mechanically acquired, defeasible forever).
// A candidate is NEVER promoted to given by this module. Promotion
// needs a named human or process giver — hl.js's own requireGiver
// enforces this even if a caller tries to skip it — because "the
// corpus never showed a counterexample" and "this relation is
// functional" are different claims, and conflating them is exactly the
// mistake this whole probe line exists to refuse.
//
// GRAMMAR IS AN OVERLAY, NEVER LOAD-BEARING STRUCTURE. This module
// counts structure — does a subject bind more than one object for a
// relation — it does not parse harder to fix a specimen. The grammar
// lens is used ONLY as a REJECTION filter (a settled non-verb
// connector is excluded before counting starts — "at" and "war" are
// not candidate relations no matter how clean their cardinality looks),
// never to re-derive subject/verb/object roles or to second-guess an
// edge extractRelations already produced. A concurrent session's live
// "chase" work hit the failure this discipline exists to prevent: hand-
// tuning subject/verb/object per specimen regressed one case for every
// one it fixed, rediscovering (one parameter at a time) the exact
// paraphrase-intolerance ceiling MINE-1's own eleven passes already
// found and disclosed in CLAUDE.md. If a relation's edges are
// mis-extracted, that is the extractor's own disclosed residue
// (grammar-lens.js's `mismatchedConnectors`, unrelated to this module)
// — never something this module tries to patch by parsing more
// aggressively.
//
// SEARCH-FIRST: no new statistic. `EVIDENCE_FLOOR = 2` is not a tuned
// number — it is the SAME structural minimum `emergence/binding.js`'s
// own co-arrival admission already uses ("one arrival has no
// co-arrival to test"), reused rather than re-derived, per this
// repo's own standing rule.

import {
  createDeclarationLog,
  proposeCandidate,
  promote as promoteDeclaration,
  concede as concedeDeclaration,
  foldDeclarations,
} from "../interpretation/declarations.js";
import { createStage, addAnchor, addEdge, declareFunctional } from "../interpretation/hl.js";

export const EVIDENCE_FLOOR = 2; // binding.js's own structural minimum, reused, not re-derived

const foldStr = (s) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Compose the reader + the grammar lens + the refutation scan over a
 * `report` from hypergraph.js's makeRelationReader. `classifyConnector`
 * is grammar-lens.js's makeGrammarLens(...) return value — injected,
 * optional (omitted, every relation stays in the count; the lens only
 * ever REMOVES candidates, never adds one grammar alone couldn't
 * justify).
 *
 * FIXED (found live, same bug class grammar-lens.js's own header now
 * names): this used to read `{ minShare = 0.5 }` — a second, DIFFERENT
 * unexplained hand-picked number sitting one layer above grammar-lens.js's
 * own now-fixed `{ minShare = 0.9 }`. Two different silent defaults for
 * the identical parameter, in two different files, is exactly the
 * "hand-tuning per specimen" this file's own header already refuses one
 * paragraph up — a threshold nobody chose on purpose is not safer for
 * being smaller. `minShare` is required now, but ONLY when
 * `classifyConnector` is actually supplied — it is genuinely inert
 * without a lens to apply it to (the loop below never reads it in that
 * branch), so forcing every caller to declare a meaningless number for a
 * check they never asked for would be its own kind of unexamined
 * ceremony. Declared here (this module's own boundary), rather than left
 * to surface later as classifyConnector's own thrown error, so the
 * failure names the actual missing decision at the call site that owns
 * it.
 *
 * Returns { refuted, candidates, underpowered, rejectedByGrammar } —
 * every bucket disclosed, none silently dropped.
 */
export function scanFunctionalCandidates(edges, { classifyConnector = null, minShare } = {}) {
  if (classifyConnector && !Number.isFinite(minShare)) {
    throw new TypeError("scanFunctionalCandidates: minShare is declared — how dominant a candidate must be is never a default (only required when classifyConnector is supplied)");
  }
  const rels = [...new Set((edges ?? []).map((e) => foldStr((e.label ?? e.verb))))];
  const rejectedByGrammar = [];
  const verbLike = new Set();
  for (const rel of rels) {
    if (!classifyConnector) {
      verbLike.add(rel);
      continue;
    }
    const c = classifyConnector({ verb: rel }, { minShare });
    if (c.settled && c.thraxClass !== "verb") rejectedByGrammar.push({ rel, thraxClass: c.thraxClass });
    else verbLike.add(rel); // unsettled/out-of-vocabulary: a disclosed gap, never a rejection
  }

  const byRel = new Map();
  for (const e of edges ?? []) {
    if (!e || e.polarity !== "+") continue;
    const rel = foldStr((e.label ?? e.verb));
    if (!verbLike.has(rel)) continue;
    let subjects = byRel.get(rel);
    if (!subjects) byRel.set(rel, (subjects = new Map()));
    const s = foldStr((e.end1 ?? e.subject));
    let objs = subjects.get(s);
    if (!objs) subjects.set(s, (objs = new Set()));
    objs.add(foldStr((e.end2 ?? e.object)));
  }

  const refuted = [], candidates = [], underpowered = [];
  for (const [rel, subjects] of byRel) {
    const counterexample = [...subjects.entries()].find(([, objs]) => objs.size > 1);
    if (counterexample) {
      refuted.push({ rel, witness: `"${counterexample[0]}" binds ${counterexample[1].size} distinct objects`, subjects: subjects.size });
    } else if (subjects.size >= EVIDENCE_FLOOR) {
      candidates.push({ rel, subjects: subjects.size });
    } else {
      underpowered.push({ rel, subjects: subjects.size });
    }
  }
  candidates.sort((a, b) => b.subjects - a.subjects);
  refuted.sort((a, b) => b.subjects - a.subjects);
  return { refuted, candidates, underpowered, rejectedByGrammar };
}

/**
 * Run the scan and land every candidate as a PROPOSE entry on a
 * declaration log — the mechanical half of acquisition. Never promotes;
 * never declares functional on any hl.js stage. `source` names where
 * the scan ran (a fixture id, a corpus name) so the acquisition is
 * checkable, not just its conclusion.
 */
export function acquireCandidates(declarationLog, edges, { classifyConnector = null, minShare, source }) {
  if (!source) throw new Error("hl-acquire: acquireCandidates requires a source — where the scan ran");
  const scan = scanFunctionalCandidates(edges, { classifyConnector, minShare });
  let log = declarationLog;
  const proposed = [];
  for (const c of scan.candidates) {
    const { id, log: log2 } = proposeCandidate(log, {
      kind: "functional",
      rel: c.rel,
      acquisition: { subjects: c.subjects, counterexamples: 0, floor: EVIDENCE_FLOOR },
      source,
    });
    log = log2;
    proposed.push({ id, rel: c.rel });
  }
  return { log, proposed, scan };
}

/**
 * Check every live candidate against the CUMULATIVE edge set — every
 * edge seen so far, old and new together, never just the delta — and
 * concede (REC, never delete) any that the fuller material now refutes.
 * Cumulative, not incremental, on purpose: a counterexample is only
 * ever visible by comparing one subject's TOTAL bindings, and "zorlan
 * trades with iyla" refutes nothing on its own — it refutes only
 * alongside the earlier "zorlan trades with brannic" this function has
 * no other way to see. Every other append-only fold in this repo
 * recomputes from the whole material rather than diffing cleverly
 * against unseen prior state (the database fold's own `store.foldStore`,
 * fresh on every render); this is that rule, applied here.
 *
 * This is the mechanism R4 does not cover: hl.js's own persistence rule
 * is about edges, not about a declaration's own standing. Returns the
 * updated log and a disclosed list of what conceded and why.
 */
export function recheckCandidates(declarationLog, allEdges) {
  const fold = foldDeclarations(declarationLog);
  const rels = new Set(fold.candidates.map((c) => c.rel));
  const bySubj = new Map(); // rel -> subject -> Set(objects)
  for (const e of allEdges ?? []) {
    if (!e || e.polarity !== "+") continue;
    const rel = foldStr((e.label ?? e.verb));
    if (!rels.has(rel)) continue;
    let m = bySubj.get(rel);
    if (!m) bySubj.set(rel, (m = new Map()));
    const s = foldStr((e.end1 ?? e.subject));
    let objs = m.get(s);
    if (!objs) m.set(s, (objs = new Set()));
    objs.add(foldStr((e.end2 ?? e.object)));
  }
  let log = declarationLog;
  const conceded = [];
  for (const cand of fold.candidates) {
    const subjects = bySubj.get(cand.rel);
    if (!subjects) continue;
    const counterexample = [...subjects.entries()].find(([, objs]) => objs.size > 1);
    if (!counterexample) continue;
    const trigger = `"${counterexample[0]}" now binds ${counterexample[1].size} distinct objects for ${cand.rel} — the candidate's own unrefuted status did not survive new material`;
    const r = concedeDeclaration(log, cand.taskId, { trigger });
    if (r.ok) {
      log = r.log;
      conceded.push({ rel: cand.rel, trigger });
    }
  }
  return { log, conceded };
}

/**
 * Promote a candidate to given, with a named giver, and mirror it onto
 * a real hl.js stage's `functional` register so R2 can actually fire.
 * The only route from "unrefuted" to "convicting" — always explicit,
 * never automatic, matching hl.js's own requireGiver wall.
 */
export function promoteAndDeclare(declarationLog, stage, rel, { giver }) {
  const fold = foldDeclarations(declarationLog);
  const cand = fold.candidates.find((c) => c.rel === rel);
  if (!cand) throw new Error(`hl-acquire: no live candidate for "${rel}" to promote`);
  const p = promoteDeclaration(declarationLog, cand.taskId, { giver });
  if (!p.ok) throw new Error(`hl-acquire: promotion refused — ${JSON.stringify(p.refusal)}`);
  declareFunctional(stage, rel, { giver });
  return { log: p.log };
}
