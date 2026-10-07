// native/kernel/hypergraph-projection.js — the hypergraph is a PROJECTION
// FROM THE LOG, and the hyperlexicon is a projection of the hypergraph at
// a cursor. (kernel/hypergraph.js is the NEIGHBORHOOD kernel — reference
// closure over entries; a first cut of this file overwrote it unread,
// caught by its own consumer's import breaking. Different questions, two
// files: that one answers "what does this entry reach", this one answers
// "what graph does the log project at this cursor".)
//
// Nothing here is a store. The append-only witness log is the reality
// (V7-CUT: the log is truth, projection is convenience — the same law
// lexicon.js already implements for the dictionary); this file replays it
// to a declared cursor and reads the graph off the fold:
//
//   nodes      the beings established AS OF that cursor, each with its
//              arrival positions (identity is retrieval-time — P1 — so a
//              node at cursor 500 may be two nodes at cursor 200, and
//              scrubbing the cursor SHOWS that)
//   links      the arrangements heard by then (EOHyperedge — ordinal ends,
//              never parts of speech; S6)
//   network    the full S10 ladder, one class per rung: co-arrival COUNT
//              (arithmetic) sets what is possible; each pair's own
//              displacement null (a frequency ratio — geometric class)
//              grants STANDING; transfer entropy (transcendental) grants
//              DIRECTION, reported as rank only. Computed only when the
//              caller injects the organ bundle; otherwise a typed absence,
//              never a silent zero
//
// hyperlexiconAt() then projects the composition ledger from the SAME
// replayed entries: candidates are nominated from what the hypergraph at
// that cursor actually witnessed (acquireCompositionCandidates), and only
// a GIVEN affordance — received via `given`, giver named — licenses
// composition. Low sets possible (witnessed adjacency nominates); high
// sets probability (only the giver's grant licenses) — S9, both clauses.

import { reconstruct } from "./fold.js";
import { networkStanding, directedEdges } from "./network-standing.js";
import { createHyperlexicon, admitHyperlexiconCandidates, giveHyperlexiconAffordance } from "./hyperlexicon.js";
import { acquireCompositionCandidates } from "./relation-composition.js";

const freeze = (value) => Object.freeze(value);

const arrivalOf = (mention) => {
  const m = /^text:(\d+)$/.exec(String(mention?.witness ?? ""));
  return m ? Number(m[1]) : null;
};

/**
 * projectHypergraph(log, { atSeq, seed, standing }) -> EOHypergraph@1
 *
 * `standing`, when supplied, is the FULL declared bundle networkStanding
 * itself demands ({ bindLinks, window, draws, seed, alpha }) — this file
 * adds no defaults on top of that organ's own walls. Omitted, the
 * projection says so in a typed absence.
 */
export function projectHypergraph(log = [], { atSeq = null, seed = {}, standing = null } = {}) {
  if (!Array.isArray(log)) throw new TypeError("projectHypergraph requires the reader's log array");
  if (atSeq != null && (!Number.isInteger(atSeq) || atSeq < 0)) throw new TypeError("atSeq, when declared, is a non-negative integer log index");
  const entries = atSeq == null ? log : log.slice(0, atSeq);
  const fold = reconstruct(entries, seed);
  const graph = fold.graphEntries ?? [];

  const arrivals = new Map();
  let lastPosition = 0;
  for (const g of graph) {
    if (g?.schema !== "EOMention@1" || !g.referent) continue;
    const at = arrivalOf(g);
    if (at == null) continue;
    lastPosition = Math.max(lastPosition, at);
    const xs = arrivals.get(g.referent) ?? [];
    if (xs[xs.length - 1] !== at) xs.push(at);
    arrivals.set(g.referent, xs);
  }

  const nodes = graph
    .filter((g) => g?.schema === "EOReferent@1")
    .map((g) => freeze({ id: g.id, surfaces: g.surfaces ?? [], arrivals: freeze(arrivals.get(g.id) ?? []) }));

  const links = graph
    .filter((g) => g?.schema === "EOHyperedge@1")
    .map((g) => freeze({ id: g.id, relation: g.relation ?? null, participants: g.participants ?? [], meta: g.meta ?? null }));

  // THE MERGE RECORD, PROJECTED (P165). This file's own header has said since
  // it was written that "a node at cursor 500 may be two nodes at cursor 200,
  // and scrubbing the cursor SHOWS that" — and it did not show it, because
  // the perceiver discarded the merge record and nothing here could carry
  // what was never landed. Now it is landed (EOReferentMerge@1, recursive.js)
  // and projected here as TESTIMONY: kept, folded, the surface that proved it.
  //
  // ADDITIVE, and deliberately not folded into `nodes`: the node shape
  // {id, surfaces, arrivals} is what read-cost.mjs --projection-identity
  // hashes, and a representation change must not masquerade as a reading
  // change. A consumer wanting `foldedInto` on a node derives it from here.
  const merges = graph
    .filter((g) => g?.schema === "EOReferentMerge@1")
    .map((g) => freeze({ id: g.id, kept: g.kept, folded: freeze([...(g.folded ?? [])]), witness: g.witness ?? null, encounterRef: g.encounterRef ?? null }));
  const reassignments = graph
    .filter((g) => g?.schema === "EOReferentReassignment@1")
    .map((g) => freeze({ id: g.id, from: g.from, to: g.to, surface: g.surface ?? null, encounterRef: g.encounterRef ?? null }));

  const network = standing
    ? (() => {
        const beings = nodes.map((n) => ({ id: n.id, arrivals: [...n.arrivals] }));
        const s = networkStanding(beings, standing);
        // Direction runs ONLY over admitted edges (the ladder's own order:
        // standing licenses the transcendental question) and only when the
        // caller supplied buildLink beside bindLinks — one bundle, both
        // organs, or the rung is a typed absence.
        const direction = typeof standing.buildLink === "function"
          ? (() => {
              const d = directedEdges(beings, s.edges, { buildLink: standing.buildLink, totalUnits: Math.max(2, lastPosition + 1), draws: standing.draws, seed: standing.seed });
              return freeze({ computed: true, oriented: d.directed, undetermined: freeze(d.undetermined.map((u) => freeze({ ...u }))) });
            })()
          : freeze({ computed: false, absence: "no buildLink injected — standing without direction; add buildLink to the bundle for the transcendental rung" });
        // `refused` and `belowFloor` used to collapse to `.length` here —
        // the pair ids (`a`/`b`), the below-floor being's own id, and each
        // row's typed reason were computed by networkStanding and then
        // thrown away at this return. That made a refusal cheaper to
        // recompute than to read: nothing downstream (the Relate row) could
        // ask WHICH pair was refused, or why, without re-running the null.
        // `edges` and `direction.oriented` were never collapsed this way —
        // this brings refused/belowFloor/undetermined to the same shape,
        // each row's being-id an address into `nodes`, not a spelling.
        return freeze({ computed: true, declared: s.declared, edges: s.edges, refused: freeze(s.refused.map((r) => freeze({ ...r }))), belowFloor: freeze(s.belowFloor.map((b) => freeze({ ...b }))), direction });
      })()
    : freeze({ computed: false, absence: "no standing bundle injected — co-arrival pairs are presence only, not edges; inject { bindLinks, window, draws, seed, alpha } to compute standing" });

  return freeze({
    schema: "EOHypergraph@1",
    projectedFrom: freeze({ logEntries: entries.length, ofTotal: log.length, atSeq, basis: "replayed from the append-only witness log via reconstruct(); not read from a live Fold" }),
    cursorExtent: lastPosition,
    nodes: freeze(nodes),
    links: freeze(links),
    merges: freeze(merges),
    reassignments: freeze(reassignments),
    network,
    // Downstream projections of THIS cursor read the reconstructed fold's
    // graph entries — the log rows are DELTAS, and a first cut handed the
    // composition ledger raw deltas and got a silently empty ledger (the
    // probe, not reasoning, found it: log schemas were Encounter/DeltaFold/
    // Observation only).
    graphEntries: graph,
  });
}

/**
 * hyperlexiconAt(hypergraph, { given }) -> EOHyperlexicon@1
 *
 * The composition ledger AS OF the hypergraph's own cursor: candidates are
 * nominated from the replayed entries the hypergraph itself was projected
 * from — never from the whole log, or the cursor would be a lie. `given`
 * carries received affordances ({ left, right, giver, witnesses? }); each
 * must name its giver (the ledger's own wall).
 */
export function hyperlexiconAt(hypergraph, { given = [], projectBindings = null } = {}) {
  if (hypergraph?.schema !== "EOHypergraph@1") throw new TypeError("hyperlexiconAt projects from a projected hypergraph — project one first (the log is the reality, this is a view of a view)");
  let hl = createHyperlexicon({ meta: { atSeq: hypergraph.projectedFrom.atSeq, projectedFrom: "EOHypergraph@1" } });
  // The composition ledger's bridges need BINDINGS (an anchored descriptor
  // IS a definite binding), and the evidence for them already sits in the
  // log slice as EOAnchorEvidence@1. The converter is the text adapter's
  // (anchorAsDefiniteBinding) and the kernel may not import an adapter —
  // the dependency law — so it arrives INJECTED; absent, the ledger reads
  // only what the log carries natively, and the caller was told how to
  // widen it rather than finding a silently smaller ledger.
  const projected = typeof projectBindings === "function"
    ? hypergraph.graphEntries.flatMap((e) => { const b = projectBindings(e); return b ? [b] : []; })
    : [];
  const candidates = acquireCompositionCandidates([...hypergraph.graphEntries, ...projected]);
  hl = admitHyperlexiconCandidates(hl, candidates);
  for (const g of given) hl = giveHyperlexiconAffordance(hl, g);
  return hl;
}
