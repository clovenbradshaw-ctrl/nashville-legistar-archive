import { sha256hex } from "./sha256hex.js";

// THE-ADDRESS.md applied (2026-09-13). `ref-occ:` ids name OCCURRENCES —
// content, so A4: each id is the SHA-256 of (encounterRef + exactSurface +
// canonicalSurface + the discourse byte offset). Same occurrence re-read
// dedups; different content never collides. `discourse-link:` is an ACT over
// two occurrences — A5: hashed over (left + right + kind). The
// `ref:discourse:` projection names a BEING — A2, birth-named — left
// untouched.

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const norm = (x) => (String(x ?? "").toLowerCase().match(WORD) ?? []).join(" ");
const slug = (x) => norm(x).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

const descriptor = ({ encounterRef, offset, exactSurface, canonicalSurface, determination = "definite", basis }) => {
  const canon = canonicalSurface ?? norm(exactSurface);
  return Object.freeze({
    schema: "EOReferentOccurrence@1",
    // A4 (THE-ADDRESS.md): content occurrence — the id hashes the
    // occurrence's own content (encounter + exact surface + canonical
    // surface + the discourse byte offset), so a re-read of the same
    // occurrence at the same position dedups and nothing else collides.
    id: sha256hex(`ref-occ|enc:${encounterRef ?? "unknown"}|discourse|off:${offset}|exact:${exactSurface}|canon:${canon}`),
    surface: exactSurface,
    canonicalSurface: canon,
    exactSurface,
    determination,
    role: null,
    encounterRef,
    edge: null,
    relation: null,
    standing: "unresolved_identity",
    provenance: Object.freeze({ giver: "text/discourse-referents", basis }),
  });
};

const bind = ({ left, right, witness, kind, basis }) => Object.freeze({
  schema: "EODiscourseIdentityLink@1",
  // A5 (THE-ADDRESS.md): a link is an ACT over two occurrences — hashed over
  // (left + right + kind), so the same link under the same kind dedups and
  // a different pair is a different link. The occurrences' own ids are
  // content hashes, so the link's content is two content addresses + the
  // label.
  id: sha256hex(`discourse-link|left:${left.id}|right:${right.id}|kind:${kind}`),
  leftOccurrence: left.id,
  rightOccurrence: right.id,
  witness,
  kind,
  standing: "supported",
  provenance: Object.freeze({ giver: "text/discourse-referents", basis }),
});

/**
 * Explicit English apposition between TWO descriptor occurrences.
 *
 * Example: "the wretch—the miserable monster whom I had created".
 * The right-hand phrase is preserved exactly, while its conservative head
 * projection is `the monster`; this is a text-adapter grammatical projection,
 * not a synonym assertion. The identity link concerns these two occurrences
 * only. It says nothing about every future use of either surface.
 */
export function appositionalDescriptorBindings(text, { encounterRef = "unknown", witness = null } = {}) {
  const source = String(text ?? "");
  const outOccurrences = [];
  const links = [];
  // Narrow shape: definite descriptor, dash/comma, definite descriptor of one
  // or two lexical words, then a relative/comma boundary. This intentionally
  // does not attempt a general NP grammar.
  const re = /\b(the\s+[\p{L}][\p{L}\p{M}'’]*)\s*(?:—|–|-)\s*(the\s+([\p{L}][\p{L}\p{M}'’]*)(?:\s+([\p{L}][\p{L}\p{M}'’]*))?)(?=\s+(?:who|whom|that)\b|\s*[,;:])/giu;
  let m;
  while ((m = re.exec(source))) {
    const leftExact = m[1];
    const rightExact = m[2];
    const rightHead = `the ${m[4] ?? m[3]}`;
    const left = descriptor({
      encounterRef,
      offset: m.index,
      exactSurface: leftExact,
      canonicalSurface: norm(leftExact),
      basis: "left side of explicit descriptor apposition",
    });
    const right = descriptor({
      encounterRef,
      offset: m.index + m[0].indexOf(rightExact),
      exactSurface: rightExact,
      canonicalSurface: norm(rightHead),
      basis: "right side of explicit descriptor apposition; final lexical item projected as head",
    });
    outOccurrences.push(left, right);
    links.push(bind({
      left,
      right,
      witness,
      kind: "apposition",
      basis: "explicit appositional construction supports occurrence-level co-reference",
    }));
  }
  return Object.freeze({
    schema: "EOTextDiscourseBindings@1",
    occurrences: Object.freeze(outOccurrences),
    links: Object.freeze(links),
  });
}

/**
 * Current discourse-referent projection from immutable occurrence/link history.
 * Only linked occurrence components of size >=2 become referents. Same surface
 * recurrence alone is deliberately insufficient.
 *
 * INCREMENTAL over the fold's delta stream (kernel chainView): occurrences
 * and links are add-only (a link is born "supported" and never re-emitted;
 * the "refused" filter is defensive), so the union-find, the per-component
 * link lists and the per-component GROUPS persist across encounters and
 * each delta folds in O(delta). Any UPDATE touching these schemas demands
 * the from-scratch path — exactness first. A link arriving before its
 * occurrences waits in `pending` and is retried as they land, so arrival
 * order inside or across deltas cannot diverge from the whole-history
 * reading.
 *
 * ── THE TIME TERM THIS CLOSES (measured, 2026-09-07) ─────────────────────
 *
 * P157 gave this projection an incremental state and a memo, and its header
 * said the fallback to a whole-array computation happened "twice in a
 * novel". Profiled on War and Peace, 1,707 -> 3,051 sentences (1.79×): the
 * projection's inclusive time grew 7.9× and the from-scratch lambda 12.5× —
 * 30% of the read at 240 KB. The fallback was the COMMON case: this
 * sentence's own admissions carry a descriptor occurrence far more often
 * than twice, and each one spread a fresh array, which the chain view can
 * only compute from scratch. Two more terms sat beside it: the component
 * walk over EVERY occurrence per projection (`stFind` alone 4%), and a
 * projection memo keyed on a state object that `foldStep` mutates in place
 * — stale by construction, harmless only because its consumer admits new
 * ids and ignores known ones.
 *
 * Three changes, each exact:
 *   1. The state is a class that is either PERSISTENT or a LAYER over a
 *      base. This sentence's extras fold into a layer that is projected and
 *      discarded; the persistent state is never touched by an entry the
 *      fold does not yet hold. Same shape as individuation.js's overlay.
 *   2. Groups are maintained per root and merged on union, so a projection
 *      walks the referents, not the occurrences. Group order is occurrence
 *      order (merged by index); component order is first-occurrence order
 *      (sorted by the group's first member) — the original's own order.
 *   3. The projection memo is versioned by the state's own counters
 *      (occurrences seen, links stamped), never by object identity.
 */
class DiscourseState {
  constructor(base = null) {
    this.base = base;
    this.parent = new Map();   // occurrence id -> parent id (this layer's writes)
    this.links = new Map();    // root -> [{seq, id}] (this layer's arrays)
    this.groups = new Map();   // root -> [occurrence] in occurrence order (this layer's arrays)
    this.index = new Map();    // occurrence id -> arrival index (this layer's)
    this.gone = new Set();     // roots whose links/groups this layer deleted
    this.multi = new Set();    // roots this layer made >= 2
    this.unmulti = new Set();  // roots this layer took out of >= 2
    this.count = base ? base.count : 0;   // occurrences seen (arrival index)
    this.seq = base ? base.seq : 0;       // links stamped
    this.pending = base ? [...base.pending] : [];
  }
  getParent(x) { return this.parent.has(x) ? this.parent.get(x) : this.base?.getParent(x); }
  setParent(x, v) { this.parent.set(x, v); }
  hasOcc(id) { return this.getParent(id) !== undefined; }
  indexOf(id) { return this.index.has(id) ? this.index.get(id) : this.base?.indexOf(id); }
  getLinks(r) { if (this.links.has(r)) return this.links.get(r); if (this.gone.has(r)) return undefined; return this.base?.getLinks(r); }
  setLinks(r, arr) { this.links.set(r, arr); this.gone.delete(r); }
  appendLink(r, stamped) { if (this.links.has(r)) this.links.get(r).push(stamped); else this.setLinks(r, [...(this.getLinks(r) ?? []), stamped]); }
  getGroup(r) { if (this.groups.has(r)) return this.groups.get(r); if (this.gone.has(r)) return undefined; return this.base?.getGroup(r); }
  setGroup(r, arr) { this.groups.set(r, arr); this.gone.delete(r); }
  appendOcc(r, occ) { if (this.groups.has(r)) this.groups.get(r).push(occ); else this.setGroup(r, [...(this.getGroup(r) ?? []), occ]); }
  drop(r) { this.links.delete(r); this.groups.delete(r); this.gone.add(r); }
  isMulti(r) { if (this.multi.has(r)) return true; if (this.unmulti.has(r)) return false; return this.base ? this.base.isMulti(r) : false; }
  setMulti(r, on) { if (on) { this.multi.add(r); this.unmulti.delete(r); } else { this.unmulti.add(r); this.multi.delete(r); } }
  multiRoots() { const out = this.base ? this.base.multiRoots().filter((r) => !this.unmulti.has(r)) : []; for (const r of this.multi) out.push(r); return out; }
  find(x) {
    let p = this.getParent(x);
    if (p == null) return null;
    while (p !== this.getParent(p)) p = this.getParent(p);
    let y = x;
    while (this.getParent(y) !== p) { const next = this.getParent(y); this.setParent(y, p); y = next; }
    return p;
  }
  /** Swap an updated occurrence into its group if id, surface and canonicalSurface are unchanged; false demands a recompute. */
  replaceOcc(occ) {
    if (!this.hasOcc(occ.id)) return false;
    const r = this.find(occ.id);
    const group = this.getGroup(r) ?? [];
    const i = group.findIndex((g) => g.id === occ.id);
    if (i < 0) return false;
    const was = group[i];
    if (was.surface !== occ.surface || was.canonicalSurface !== occ.canonicalSurface) return false;
    if (was === occ) return true;
    if (this.groups.has(r)) group[i] = occ; else { const copy = [...group]; copy[i] = occ; this.setGroup(r, copy); }
    return true;
  }
  addOcc(occ) {
    const i = this.count++;
    this.index.set(occ.id, i);
    if (!this.hasOcc(occ.id)) { this.setParent(occ.id, occ.id); this.setLinks(occ.id, []); this.setGroup(occ.id, [occ]); return; }
    // The same id arriving twice: the original pushed it into `occurrences`
    // again and its component listed it twice. Mirrored, so the reference path
    // and this one cannot differ on it.
    const r = this.find(occ.id);
    this.appendOcc(r, occ);
    if ((this.getGroup(r) ?? []).length >= 2 && !this.isMulti(r)) this.setMulti(r, true);
  }
}

/** Merge two groups already in occurrence order into one, by arrival index. */
const mergeByIndex = (st, a = [], b = []) => {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) { if (st.indexOf(a[i].id) <= st.indexOf(b[j].id)) out.push(a[i++]); else out.push(b[j++]); }
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
};

function foldDiscourse(st, entries) {
  const tryLink = (link) => {
    const ra = st.find(link.leftOccurrence);
    const rb = st.find(link.rightOccurrence);
    if (ra == null || rb == null) return false;
    const stamped = { seq: st.seq++, id: link.id };
    if (ra === rb) { st.appendLink(ra, stamped); return true; }
    const [keep, drop] = ra < rb ? [ra, rb] : [rb, ra]; // stable by lexical id — the original's own tiebreak
    st.setParent(drop, keep);
    st.setLinks(keep, [...(st.getLinks(keep) ?? []), ...(st.getLinks(drop) ?? []), stamped]);
    st.setGroup(keep, mergeByIndex(st, st.getGroup(keep), st.getGroup(drop)));
    st.drop(drop);
    if (st.isMulti(drop)) st.setMulti(drop, false);
    if (!st.isMulti(keep)) st.setMulti(keep, true);
    return true;
  };
  for (const x of entries ?? []) {
    if (x?.schema === "EOReferentOccurrence@1") {
      st.addOcc(x);
      if (st.pending.length) st.pending = st.pending.filter((l) => !tryLink(l));
    } else if (x?.schema === "EODiscourseIdentityLink@1" && x.standing !== "refused") {
      if (!tryLink(x)) st.pending.push(x);
    }
  }
}

import { chainView } from "../../kernel/fold.js";

/** Exported for the test that pins the invariant: how many times the from-scratch path ran. */
export const discourseStats = { computes: 0 };

const discourseState = chainView(
  (graphEntries) => {
    discourseStats.computes += 1;
    const st = new DiscourseState();
    foldDiscourse(st, graphEntries);
    return st;
  },
  (st, d) => {
    // AN UPDATE THAT KEEPS WHAT THIS STATE READS IS REPLACED IN PLACE (2026-09-07).
    // A descriptor occurrence whose participant carries no occurrence id falls
    // back to its surface slug, so two edges in one sentence sharing a surface
    // yield ONE id with different `edge`/`relation` fields — a real update,
    // 112 times at 240 KB, and each one used to demand this whole state from
    // scratch (26x growth at 480 KB). This state reads an occurrence's id,
    // surface and canonicalSurface and nothing else; an update that keeps
    // those three is the same occurrence to it, and the object is swapped at
    // its position. Anything else, or a link update, still recomputes.
    // Appended first, then updated — one call can do both to one id, and the
    // update is the later fact (see identity.js's edge index for the case
    // the 480 KB gate caught).
    foldDiscourse(st, d.appended);
    for (const x of d.updated) {
      if (x?.schema === "EODiscourseIdentityLink@1") return null;
      if (x?.schema !== "EOReferentOccurrence@1") continue;
      if (!st.replaceOcc(x)) return null;
    }
    return st;
  },
);

/** THE PROJECTION, MEMOISED ON ITS STATE'S OWN VERSION — (count, seq), never object identity. */
const PROJECTION = new WeakMap();

function projectState(st) {
  const roots = st.multiRoots().filter((r) => (st.getLinks(r) ?? []).length > 0);
  roots.sort((a, b) => st.indexOf(st.getGroup(a)[0].id) - st.indexOf(st.getGroup(b)[0].id));
  const referents = [];
  for (const root of roots) {
    const group = st.getGroup(root);
    const stampedLinks = st.getLinks(root);
    // Global arrival order, dedup by id — the original's own [...linkedIds]
    // Set semantics over the links array.
    const linkedIds = [...new Map([...stampedLinks].sort((a, b) => a.seq - b.seq).map((l) => [l.id, l])).keys()];
    const surfaces = [...new Set(group.map((x) => x.canonicalSurface).filter(Boolean))];
    referents.push(Object.freeze({
      schema: "EOReferent@1",
      id: `ref:discourse:${slug(root)}`,
      display: group[0].surface,
      surfaces: Object.freeze(surfaces),
      occurrenceRefs: Object.freeze(group.map((x) => x.id)),
      supportRefs: Object.freeze([...linkedIds]),
      standing: "provisional",
      revisable: true,
      provenance: Object.freeze({
        giver: "text/discourse-referents::projectDiscourseReferents",
        basis: "connected component of explicitly supported occurrence-level identity links",
      }),
    }));
  }
  return Object.freeze(referents);
}

/** Only these two schemas can change a discourse state (see `foldDiscourse`). Anything else is inert here. */
const touchesDiscourse = (entries = []) =>
  entries.some((x) => x?.schema === "EOReferentOccurrence@1" || (x?.schema === "EODiscourseIdentityLink@1" && x.standing !== "refused"));

/**
 * projectDiscourseReferentsWith(foldEntries, extraEntries) — the entry point
 * a caller with a chain-linked fold array should use (P157).
 *
 * THE DEFECT THIS EXISTS FOR. `reviseTextFold` called
 * `projectDiscourseReferents([...(fold?.graphEntries ?? []), ...currentGraphEntries])`
 * — a FRESH ARRAY LITERAL. `DELTA` is populated in exactly one place,
 * `upsertManyById` (fold.js), so a spread can never carry a delta link, so
 * `chainView`'s walk-back broke on its first step and the from-scratch path
 * ran EVERY SENTENCE over the entire fold. Measured over a whole Frankenstein
 * read: 3,392 calls, ZERO memo hits, zero walk hits, 3,392 full recomputes,
 * 37,274,742 elements scanned. The incremental path was never refused — it
 * was never reachable.
 *
 * One screen above it, `descriptorHypothesesWith(fold?.graphEntries ?? [],
 * extras)` passes the fold's own array and hits 3,391 times out of 3,392.
 * This is that shape, applied here.
 *
 * The fast path is exact rather than approximate: `foldDiscourse` reads only
 * `EOReferentOccurrence@1` and unrefused `EODiscourseIdentityLink@1`, so
 * extras containing neither cannot change the state, and the cached
 * projection IS the answer. When they do contain one — twice in a novel —
 * this falls back to the original whole-array computation, which is the
 * reference path, so nothing can diverge.
 */
export function projectDiscourseReferentsWith(foldEntries = [], extraEntries = []) {
  if (!touchesDiscourse(extraEntries)) return projectDiscourseReferents(foldEntries);
  // This sentence's own admissions, folded into a LAYER over the persistent
  // state and projected from there. The layer is discarded; the persistent
  // state never holds an entry the fold does not. The fold's own array is
  // what reaches the chain view, so the incremental path is the one taken.
  const layer = new DiscourseState(discourseState(foldEntries));
  foldDiscourse(layer, extraEntries);
  return projectState(layer);
}

export function projectDiscourseReferents(graphEntries = []) {
  const st = discourseState(graphEntries);
  const cached = PROJECTION.get(st);
  if (cached && cached.count === st.count && cached.seq === st.seq) return cached.value;
  const value = projectState(st);
  PROJECTION.set(st, { count: st.count, seq: st.seq, value });
  return value;
}
