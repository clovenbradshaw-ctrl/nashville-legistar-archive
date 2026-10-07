// unravel.js — SEG·Pattern: cutting a pattern apart at its own seams.
//
// The one cell CAPACITY-DEVELOPMENT-PLAN.md called "the only cell with no
// candidate anywhere": nothing in either repo decomposed a Network — no
// separation over the belief graph, no edge-set removal leaving two
// readable sub-networks. This module is that organ, and it is deliberately
// PARAMETER-FREE: the seams it cuts at are the graph's own bridges (edges
// whose removal disconnects it — a structural fact, not a score), so there
// is no community-detection threshold to tune and none is invented. A
// 2-edge-connected network genuinely has no single-edge seam, and the
// honest answer there is a TYPED REFUSAL (`no_seam`), never a cut bought
// with an invented parameter — the same posture measure.js's gate and the
// void loop's graded refusals already hold this repo to.
//
// Pure: imports nothing, reads no document, knows no domain vocabulary —
// nodes are opaque ids, edges are pairs. The grain-refinement discipline
// (P60's fourth amendment: "a mechanism that needs material labelled in
// one domain's vocabulary has learned that domain") is enforced by this
// file's own test scanning this file's source for domain words.
//
// Determinism is load-bearing (the record replays): adjacency is built in
// sorted order, the DFS is iterative (no recursion limit on a large belief
// graph) and rooted in sorted node order, and every output list is sorted.
// Bridges are found by Tarjan's low-link walk over EDGE ids, not parent
// nodes — the textbook parent-skip breaks on parallel edges, and a doubled
// edge between two clusters is precisely NOT a seam (removing one copy
// disconnects nothing), which the edge-id walk gets right by construction.
//
// Provenance: a cut edge is reported with its INDEX into the caller's own
// edge array and the edge object itself carried verbatim — the address a
// caller needs to walk back to whatever its edges carry (witnesses, spans),
// this repo's standing rule that a finding names its bytes.

export const CELL = Object.freeze({ op: "SEG", grain: "Pattern" });

const idOf = (v) => String(v);

/**
 * @param {Array<{a: any, b: any}>} edges — pairs of node ids; extra fields
 *   ride through untouched. `nodes` may add isolated nodes the edges never
 *   mention. Ids are compared AS STRINGS (String(v)) — declare them as
 *   strings; numeric 1 and "1" would collide, and an object id collapses
 *   to its default stringification. An edge missing either end is refused
 *   by index (`malformed_edges`) rather than coining a phantom node.
 * @returns {{
 *   components: string[][],
 *   bridges: Array<{index: number, a: string, b: string, edge: object}>,
 *   articulationPoints: string[],
 *   parts: string[][] | null,
 *   cutEdges: Array<{index: number, a: string, b: string, edge: object}> | null,
 *   refused: {type: string, detail: string} | null,
 * }}
 */
export function unravel(edges = [], { nodes = [] } = {}) {
  const malformed = [];
  (edges ?? []).forEach((e, index) => { if (e?.a === undefined || e?.b === undefined) malformed.push(index); });
  if (malformed.length) {
    return {
      components: [], bridges: [], articulationPoints: [], parts: null, cutEdges: null,
      refused: { type: "malformed_edges", indices: malformed, detail: "an edge missing either end cannot be read — refused by the caller's own indices rather than coining a phantom node" },
    };
  }
  const edgeList = (edges ?? []).map((e, index) => ({ index, a: idOf(e.a), b: idOf(e.b), edge: e }));
  const nodeSet = new Set((nodes ?? []).map(idOf));
  for (const e of edgeList) { nodeSet.add(e.a); nodeSet.add(e.b); }
  const nodeIds = [...nodeSet].sort();

  if (nodeIds.length === 0) {
    return {
      components: [], bridges: [], articulationPoints: [], parts: null, cutEdges: null,
      refused: { type: "no_material", detail: "no nodes and no edges — there is nothing to unravel" },
    };
  }

  // adjacency: node -> [{to, edgeIndex}], sorted for determinism
  const adjacency = new Map(nodeIds.map((id) => [id, []]));
  for (const e of edgeList) {
    if (e.a === e.b) continue; // a self-loop is never a seam and never connects
    adjacency.get(e.a).push({ to: e.b, edgeIndex: e.index });
    adjacency.get(e.b).push({ to: e.a, edgeIndex: e.index });
  }
  for (const list of adjacency.values()) {
    list.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : x.edgeIndex - y.edgeIndex));
  }

  // Iterative Tarjan over edge ids: disc/low per node, a bridge where
  // low[child] > disc[node]; articulation by the standard root/non-root
  // conditions. One walk serves components, bridges and articulation.
  const disc = new Map();
  const low = new Map();
  const componentOf = new Map();
  const bridges = [];
  const articulation = new Set();
  let timer = 0;
  let componentIndex = -1;

  for (const root of nodeIds) {
    if (disc.has(root)) continue;
    componentIndex += 1;
    let rootChildren = 0;
    // stack frames: {node, viaEdge, neighbors index}
    const stack = [{ node: root, viaEdge: -1, i: 0 }];
    disc.set(root, timer); low.set(root, timer); timer += 1;
    componentOf.set(root, componentIndex);
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const neighbors = adjacency.get(frame.node);
      if (frame.i < neighbors.length) {
        const { to, edgeIndex } = neighbors[frame.i];
        frame.i += 1;
        if (edgeIndex === frame.viaEdge) continue; // came in on this edge; a PARALLEL edge has its own id and is followed
        if (!disc.has(to)) {
          if (frame.node === root) rootChildren += 1;
          disc.set(to, timer); low.set(to, timer); timer += 1;
          componentOf.set(to, componentIndex);
          stack.push({ node: to, viaEdge: edgeIndex, i: 0 });
        } else {
          low.set(frame.node, Math.min(low.get(frame.node), disc.get(to)));
        }
      } else {
        stack.pop();
        if (stack.length) {
          const parent = stack[stack.length - 1];
          low.set(parent.node, Math.min(low.get(parent.node), low.get(frame.node)));
          if (low.get(frame.node) > disc.get(parent.node)) {
            const e = edgeList[frame.viaEdge];
            bridges.push({ index: e.index, a: e.a, b: e.b, edge: e.edge });
          }
          if (parent.node !== root && low.get(frame.node) >= disc.get(parent.node)) {
            articulation.add(parent.node);
          }
        }
      }
    }
    if (rootChildren > 1) articulation.add(root);
  }

  bridges.sort((x, y) => x.index - y.index);
  const components = groupSorted(nodeIds, (id) => componentOf.get(id));

  if (bridges.length === 0) {
    if (components.length > 1) {
      // Already in parts — reported as the separation the material itself
      // carries; nothing was cut and cutEdges says so honestly.
      return { components, bridges, articulationPoints: [...articulation].sort(), parts: [...components], cutEdges: [], refused: null };
    }
    return {
      components, bridges, articulationPoints: [...articulation].sort(), parts: null, cutEdges: null,
      refused: {
        type: "no_seam",
        detail: "the network is 2-edge-connected — no single edge's removal separates it; cutting it anyway would need an invented threshold, which this organ refuses to carry",
      },
    };
  }

  // The cut: remove every bridge, re-read the components.
  const bridgeIndices = new Set(bridges.map((b) => b.index));
  const partOf = new Map();
  let partIndex = -1;
  for (const root of nodeIds) {
    if (partOf.has(root)) continue;
    partIndex += 1;
    const queue = [root];
    partOf.set(root, partIndex);
    while (queue.length) {
      const node = queue.pop();
      for (const { to, edgeIndex } of adjacency.get(node)) {
        if (bridgeIndices.has(edgeIndex) || partOf.has(to)) continue;
        partOf.set(to, partIndex);
        queue.push(to);
      }
    }
  }
  const parts = groupSorted(nodeIds, (id) => partOf.get(id));
  return { components, bridges, articulationPoints: [...articulation].sort(), parts, cutEdges: [...bridges], refused: null };
}

function groupSorted(nodeIds, keyOf) {
  const groups = new Map();
  for (const id of nodeIds) {
    const k = keyOf(id);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(id);
  }
  const out = [...groups.values()].map((g) => g.sort());
  out.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0));
  return out;
}
