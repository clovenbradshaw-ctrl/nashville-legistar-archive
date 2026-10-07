// skeleton.js — THE CONTENT, BUILT AS ASSERTIONS BEFORE IT IS EVER PROSE.
//
// The order this engine ran in until now: declare a shape, let the mouth write
// prose into each slot, then extract a claim-level model FROM the prose and
// fold that. Structure came last. Three consequences, all measured on real
// runs:
//
//   * REPETITION BY CONSTRUCTION. Each part independently queried the whole
//     pool of the material's assertions, so the same claim was handed to part
//     two and part four alike. The mouth said it twice because it was asked
//     twice, and the selector then refused it for repeating. The machinery was
//     blaming the mouth for obeying the plan.
//   * AN EMPTY PART IS DISCOVERED, NOT DECLARED. A part with nothing of its
//     own to say costs a model call to find that out.
//   * MOTION CANNOT BE PLANNED, ONLY HOPED FOR. Whether one part takes up what
//     the last put down was left to the mouth and measured afterwards.
//
// The skeleton inverts that. It is the whole content as ASSERTIONS, allocated
// and ordered mechanically, before a word is drawn — the repo's own standing
// rule that structure is mechanical and the model is fed the computed answer,
// applied to content rather than only to shape. Nothing here calls a model.
//
// THE LAW AT EVERY LEVEL. The material's assertions set what is POSSIBLE: a
// node can only exist where assertions exist to carry it. The ask sets what is
// PROBABLE: how many nodes there are at the top. Neither is a table.
//
// HOW A NODE IS FOUND. A referent carried by every assertion is the piece's
// SUBJECT, and it distinguishes no part from another — the same reasoning the
// admission module applies to words, applied to referents. The parts are found
// in what is left: each assertion is allocated to the rarest referent it
// carries, and that referent names the node. Allocation is EXCLUSIVE, so an
// assertion belongs to exactly one node and no two nodes can say it.
//
// THE RECURSION. A node is split again by the referents that remain once its
// own is set aside. A node whose assertions carry nothing further to
// distinguish them is a leaf — the recursion ends where the material stops
// making distinctions, not at a depth we chose.
//
// THE THREAD. Sibling nodes are ordered so that each shares a referent with
// the one before where it can. That shared referent is the node's BRIDGE, and
// it is the planned turn: what this part takes up from the last. Motion stops
// being something to measure in the prose afterwards and becomes something the
// skeleton already knows.
//
// Every node is usable on its own: its assertions are a readable statement of
// what that part claims, before anyone writes a sentence.

export const SKELETON_SCHEMA = "EOSkeleton@1";

const surfaceOf = (x) => String(x ?? "").toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();

/** The referents an assertion carries. The default reads its two ends; a
 *  caller with a real referent index supplies one that resolves names to
 *  beings, which is the same call `continues` takes in the admission. */
export function defaultReferentsOf(a) {
  const out = new Set();
  for (const end of [a?.end1 ?? a?.subject, a?.end2 ?? a?.object]) {
    const s = surfaceOf(end);
    if (s && s !== "?") out.add(s);
  }
  return out;
}

const keyOf = (a) => `${surfaceOf(a?.end1 ?? a?.subject)}|${String(a?.label ?? a?.verb ?? "").toLowerCase()}|${surfaceOf(a?.end2 ?? a?.object)}`;

/**
 * buildSkeleton(assertions, { want, referentsOf, title }) → the piece as a
 * tree of assertion-bearing nodes. Pure: no model, no I/O, deterministic.
 */
export function buildSkeleton(assertions = [], { want = null, referentsOf = defaultReferentsOf, title = "the piece" } = {}) {
  // One assertion per claim: the same claim twice is one thing the piece says.
  const byKey = new Map();
  const dropped = [];
  for (const a of assertions ?? []) {
    const k = keyOf(a);
    if (!k.replace(/\|/g, "").trim()) { dropped.push({ ...a, reason: "no ends" }); continue; }
    if (byKey.has(k)) { dropped.push({ ...a, reason: "same assertion" }); continue; }
    byKey.set(k, { ...a, key: k, referents: [...referentsOf(a)] });
  }
  const all = [...byKey.values()];
  if (!all.length) return { schema: SKELETON_SCHEMA, title, subject: [], root: null, nodes: [], dropped, basis: "no assertions — no skeleton can be built from them" };

  const root = splitNode(all, new Set(), `${title}`, 0);
  // THE ASK SETS THE PROBABILITY: when it names a count and the material
  // offers more parts than that, the smallest are folded into the sibling
  // they share most with — never truncated, because a dropped part is a
  // claim the piece would silently stop making.
  if (want && root.children.length > want) mergeTo(root, want);
  order(root);
  const nodes = [];
  walk(root, (n) => nodes.push(n));
  const subject = [...subjectReferents(all)];
  return { schema: SKELETON_SCHEMA, title, subject, root, nodes, dropped,
    basis: `${all.length} assertion(s) in ${nodes.filter((n) => !n.children.length).length} leaf node(s), ${root.children.length} part(s); subject referent(s): ${subject.join(", ") || "none"}` };
}

/** Referents carried by EVERY assertion: the subject of the whole, which
 *  cannot distinguish one part from another. */
function subjectReferents(list) {
  if (!list.length) return new Set();
  let shared = new Set(list[0].referents);
  for (const a of list.slice(1)) shared = new Set([...shared].filter((r) => a.referents.includes(r)));
  return shared;
}

function splitNode(list, used, label, depth) {
  const node = { title: label, key: null, assertions: list, children: [], carries: [], bridge: null, depth };
  if (list.length < 2 || depth > 6) { node.carries = [...allReferents(list)]; return node; }
  const df = new Map();
  for (const a of list) for (const r of a.referents) { if (used.has(r)) continue; df.set(r, (df.get(r) ?? 0) + 1); }
  // A referent in every assertion of this node distinguishes nothing INSIDE
  // it, exactly as the piece's subject distinguishes nothing at the top.
  for (const [r, n] of [...df.entries()]) if (n >= list.length) df.delete(r);
  if (!df.size) { node.carries = [...allReferents(list)]; return node; }
  // EXCLUSIVE ALLOCATION: each assertion goes to the rarest referent it
  // carries — the one that says most about where it belongs.
  const groups = new Map();
  const orphans = [];
  for (const a of list) {
    let best = null; let bestDf = Infinity;
    for (const r of a.referents) {
      if (used.has(r) || !df.has(r)) continue;
      const n = df.get(r);
      if (n < bestDf || (n === bestDf && best !== null && r < best)) { best = r; bestDf = n; }
    }
    if (best == null) { orphans.push(a); continue; }
    if (!groups.has(best)) groups.set(best, []);
    groups.get(best).push(a);
  }
  if (groups.size < 2) { node.carries = [...allReferents(list)]; return node; }
  // An assertion distinguished by nothing joins the group it shares most with.
  for (const a of orphans) {
    let best = null; let bestShare = -1;
    for (const [r, g] of groups) {
      const share = g.reduce((s, x) => s + x.referents.filter((y) => a.referents.includes(y)).length, 0);
      if (share > bestShare) { bestShare = share; best = r; }
    }
    groups.get(best).push(a);
  }
  for (const [r, g] of groups) {
    const child = splitNode(g, new Set([...used, r]), r, depth + 1);
    child.key = r;
    node.children.push(child);
  }
  node.carries = [...allReferents(list)];
  return node;
}

function allReferents(list) {
  const out = new Set();
  for (const a of list) for (const r of a.referents) out.add(r);
  return out;
}

/** Fold the smallest parts into the sibling they share most referents with,
 *  until the ask's count is met. A merged part keeps its assertions. */
function mergeTo(node, want) {
  while (node.children.length > want) {
    let smallest = 0;
    for (let i = 1; i < node.children.length; i++) if (count(node.children[i]) < count(node.children[smallest])) smallest = i;
    const victim = node.children[smallest];
    let best = -1; let bestShare = -1;
    for (let i = 0; i < node.children.length; i++) {
      if (i === smallest) continue;
      const share = node.children[i].carries.filter((r) => victim.carries.includes(r)).length;
      if (share > bestShare) { bestShare = share; best = i; }
    }
    if (best < 0) break;
    const host = node.children[best];
    host.assertions = [...host.assertions, ...victim.assertions];
    host.children = [...host.children, ...victim.children];
    host.carries = [...new Set([...host.carries, ...victim.carries])];
    node.children.splice(smallest, 1);
  }
}
const count = (n) => (n.children.length ? n.children.reduce((s, c) => s + count(c), 0) : n.assertions.length);

/** THE THREAD: order siblings so each takes up a referent the one before
 *  carries, and record that referent as the node's bridge — the planned turn. */
function order(node) {
  if (node.children.length > 1) {
    const pool = [...node.children];
    // Begin with the part carrying most of the material: the ground to stand on.
    pool.sort((a, b) => count(b) - count(a) || String(a.key).localeCompare(String(b.key)));
    const chain = [pool.shift()];
    chain[0].bridge = null;
    while (pool.length) {
      const prev = chain[chain.length - 1];
      let best = 0; let bestShare = -1; let bestRef = null;
      for (let i = 0; i < pool.length; i++) {
        const shared = pool[i].carries.filter((r) => prev.carries.includes(r));
        if (shared.length > bestShare) { bestShare = shared.length; best = i; bestRef = shared[0] ?? null; }
      }
      const next = pool.splice(best, 1)[0];
      next.bridge = bestShare > 0 ? bestRef : null;
      chain.push(next);
    }
    node.children = chain;
  }
  for (const c of node.children) order(c);
}

function walk(node, fn) { fn(node); for (const c of node.children) walk(c, fn); }

/** The skeleton as EOT assertion lines — what the piece will claim, in order,
 *  before any of it is prose. This is the work product of this layer. */
export function skeletonLines(skel) {
  if (!skel?.root) return [];
  const out = [];
  walk(skel.root, (n) => {
    if (n.depth === 0) return;
    const indent = "  ".repeat(n.depth - 1);
    out.push(`${indent}${n.children.length ? "▸" : "•"} ${n.title}${n.bridge ? `   ← takes up: ${n.bridge}` : ""}`);
    if (!n.children.length) for (const a of n.assertions) {
      out.push(`${indent}    ${a.end1 ?? a.subject} — ${a.label ?? a.verb} — ${a.end2 ?? a.object}`);
    }
  });
  return out;
}

/** The leaves, in reading order: the units that get prosified, each with the
 *  assertions that are its alone and the referent it takes up from the last. */
export function skeletonLeaves(skel) {
  const out = [];
  if (!skel?.root) return out;
  walk(skel.root, (n) => { if (!n.children.length && n.assertions.length) out.push(n); });
  return out;
}
