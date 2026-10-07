import { sha256hex } from "./sha256hex.js";
import {
  ANAPHORIC_PRONOUNS,
  DEFINITE_DETERMINERS,
  INDEFINITE_DETERMINERS,
  THIRD_PERSON_SINGULAR,
} from "./priors.js";

// THE-ADDRESS.md applied (2026-09-13). `ref-occ:` ids name OCCURRENCES —
// content, so A4: each id is the SHA-256 of the occurrence's own content
// (encounterRef + canonicalSurface + head + determination + role + position).
// Same occurrence re-read dedups; different content never collides; the
// encounterRef stays IN the content so two sources never collide. The
// `identity:descriptor:` hypothesis and `ref:descriptor:` projection are
// BEINGS — A2, birth-named — left untouched.
const occurrenceContent = ({ encounterRef, canonicalSurface, head, determination, role, index }) =>
  `ref-occ|enc:${encounterRef ?? "unknown"}|canon:${canonicalSurface}|head:${head}|det:${determination}|role:${role ?? ""}|at:${index ?? ""}`;

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const norm = (x) => (String(x ?? "").toLowerCase().match(WORD) ?? []).join(" ");
const words = (x) => String(x ?? "").toLowerCase().match(WORD) ?? [];
const slug = (x) => norm(x).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

// Closed English pronominal/determiner classes belong in the text adapter,
// never in the modality-neutral kernel. Possessives are kept separate from
// personal pronouns because "my father" is referential while bare "my" is not.
const PERSONAL_PRONOUNS = new Set([
  "i", "me", "mine", "myself", "we", "us", "ours", "ourselves",
  "you", "yours", "yourself", "yourselves", "they", "them", "theirs", "themselves",
  "who", "whom", "whose", "which", "what",
]);
const POSSESSIVE_DETERMINERS = new Set(["my", "your", "his", "her", "our", "their"]);
const CLAUSE_LEADERS = new Set(["when", "where", "if", "while", "because", "although", "though", "since", "before", "after", "until"]);

const pronounToken = (w) => PERSONAL_PRONOUNS.has(w) || ANAPHORIC_PRONOUNS.has(w) || Object.hasOwn(THIRD_PERSON_SINGULAR, w);
const containsPronoun = (ws) => ws.some(pronounToken);
const determinationOf = (first) => DEFINITE_DETERMINERS.has(first)
  ? "definite"
  : INDEFINITE_DETERMINERS.has(first)
    ? "indefinite"
    : POSSESSIVE_DETERMINERS.has(first)
      ? "possessive"
      : "bare";

const occurrence = ({ surface, determination, encounterRef, role = null, edge = null, relation = null, giver, basis, at = "" }) => {
  const ws = words(surface);
  if (!ws.length) return null;
  const canonicalSurface = ws.join(" ");
  const head = ws[ws.length - 1];
  return Object.freeze({
    schema: "EOReferentOccurrence@1",
    // A4 (THE-ADDRESS.md): the occurrence's id is a content hash of its own
    // content — encounterRef + canonicalSurface + head + determination +
    // role + the byte/discriminator position — never a sequence number.
    // Same occurrence re-read dedups; different content never collides.
    id: sha256hex(occurrenceContent({ encounterRef, canonicalSurface, head, determination, role, index: at })),
    surface,
    canonicalSurface,
    head,
    determination,
    role,
    encounterRef,
    edge,
    relation,
    standing: "unresolved_identity",
    provenance: Object.freeze({ giver, basis }),
  });
};

/**
 * Classify an unresolved relation participant without deciding its identity.
 * Relation extraction can expose clause fragments as participants. Therefore
 * this channel accepts only determiner/possessive-marked descriptions.
 */
export function descriptorOccurrence(participant, { encounterRef = null, edge = null } = {}) {
  if (participant?.standing !== "unresolved_surface") return null;
  const surface = String(participant.surface ?? "").trim();
  const ws = words(surface);
  if (!surface || ws.length < 2 || containsPronoun(ws) || CLAUSE_LEADERS.has(ws[0])) return null;

  const determination = determinationOf(ws[0]);
  if (determination === "bare") return null;

  return occurrence({
    surface,
    determination,
    role: participant.role ?? null,
    encounterRef,
    edge: edge?.id ?? null,
    relation: edge?.relation ?? null,
    at: participant.occurrence ?? slug(surface),
    giver: "text/individuation::descriptorOccurrence",
    basis: "determiner-marked unresolved relation participant",
  });
}

/**
 * Direct descriptor perception from witnessed encounter text.
 * A received closed determiner class plus one following lexical token is an
 * intentionally narrow text-organ observation, not a general noun parser.
 */
export function directDescriptorOccurrences(text, { encounterRef = "unknown" } = {}) {
  const source = String(text ?? "");
  const out = [];
  const determinerAlternation = [...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS, ...POSSESSIVE_DETERMINERS]
    .sort((a, b) => b.length - a.length)
    .join("|");
  const re = new RegExp(`\\b(${determinerAlternation})\\s+([\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*)`, "giu");
  let m;
  while ((m = re.exec(source))) {
    const surface = `${m[1]} ${m[2]}`;
    const ws = words(surface);
    if (containsPronoun([ws[1]])) continue;
    out.push(occurrence({
      surface,
      determination: determinationOf(ws[0]),
      encounterRef,
      at: `direct:${m.index}`,
      giver: "text/individuation::directDescriptorOccurrences",
      basis: "closed-class determiner plus witnessed lexical form",
    }));
  }
  return Object.freeze(out.filter(Boolean));
}

import { chainView } from "../../kernel/fold.js";

// ── THE HYPOTHESIS LIST, MAINTAINED (2026-09-07) ─────────────────────────
// P157 memoised each group's hypothesis on its group ARRAY and said "an
// untouched group is the same array, so it hits". On the chain path the
// group is grown IN PLACE by `push`, so the memo was stale there — harmless
// only because revision.js admits new ids and ignores known ones. And
// `descriptorHypothesesWith` copied the whole surface map and walked every
// group per sentence: profiled at 240 KB it was 12% of the read and grew
// 7x for 1.79x the sentences.
//
// The state now carries the OUTPUT: `out`, the hypotheses in surface
// first-occurrence order, with each surface's position. A delta touches a
// few groups; only those are recomputed, and a hypothesis, once earned, is
// never lost (occurrences are add-only), so `out` only ever replaces in
// place or inserts. The per-group memo is versioned by the group's LENGTH,
// which is the only thing that can change on an append-only group. The
// output order is the original's: fold-known surfaces in first-occurrence
// order, new-only surfaces appended in arrival order — and the fresh-array
// compute path and the incremental path are pinned equal.
const HYPOTHESIS = new WeakMap(); // group array -> { surface, length, value }
function hypothesisForGroup(surface, group) {
  const hit = HYPOTHESIS.get(group);
  if (hit !== undefined && hit.surface === surface && hit.length === group.length) return hit.value;
  const one = hypothesesFrom(new Map([[surface, group]]));
  const value = one.length ? one[0] : null;
  HYPOTHESIS.set(group, { surface, length: group.length, value });
  return value;
}

const emptyState = () => ({ groups: new Map(), order: new Map(), out: [], outOrder: [], frozen: null, fresh: true, pending: new Set() });

/** Where `out` holds (or would hold) the hypothesis for a surface: binary search on the kept first-occurrence orders. */
function slot(st, surface) {
  const o = st.order.get(surface);
  let lo = 0, hi = st.outOrder.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (st.outOrder[mid] < o) lo = mid + 1; else hi = mid; }
  return { at: lo, found: lo < st.outOrder.length && st.outOrder[lo] === o };
}

/** Put the hypothesis for `surface` into `out` at its first-occurrence position, or replace it there. Returns whether `out` changed. */
function place(st, surface, value) {
  const { at, found } = slot(st, surface);
  if (found) {
    if (value == null) throw new Error("individuation: a hypothesis once earned cannot be lost on an append-only group");
    if (st.out[at] === value) return false;
    st.out[at] = value; return true;
  }
  if (value == null) return false;
  st.out.splice(at, 0, value); st.outOrder.splice(at, 0, st.order.get(surface));
  return true;
}

function foldGroups(st, entries, alsoTouched = []) {
  const touched = new Set(alsoTouched);
  for (const x of entries) {
    if (x?.schema !== "EOReferentOccurrence@1") continue;
    const key = x.canonicalSurface;
    if (!st.groups.has(key)) { st.groups.set(key, []); st.order.set(key, st.order.size); }
    st.groups.get(key).push(x);
    touched.add(key);
  }
  let changed = false;
  for (const key of [...touched].sort((a, b) => st.order.get(a) - st.order.get(b))) { st.pending.add(key); changed = place(st, key, hypothesisForGroup(key, st.groups.get(key))) || changed; }
  if (changed || !st.frozen) st.frozen = Object.freeze([...st.out]);
  return st;
}

const surfaceState = chainView(
  (graphEntries) => { const st = foldGroups(emptyState(), graphEntries); st.fresh = true; return st; },
  (st, d) => {
    // AN UPDATE IS REPLACED IN PLACE and its group's hypothesis recomputed
    // (2026-09-07) — the memo is bypassed for that group because a
    // hypothesis reads `edge`, `relation` and `role` off each occurrence and
    // an update is exactly what changes those. Only a changed surface key,
    // which would move the occurrence between groups, still recomputes the
    // whole state.
    // Appended first, then updated — one call can do both to one id, and the
    // update is the later fact (see identity.js's edge index for the case
    // the 480 KB gate caught).
    foldGroups(st, d.appended);
    const touched = [];
    for (const x of d.updated) {
      if (x?.schema !== "EOReferentOccurrence@1") continue;
      const group = st.groups.get(x.canonicalSurface);
      const i = group ? group.findIndex((g) => g.id === x.id) : -1;
      if (i < 0) return null;
      group[i] = x;
      HYPOTHESIS.delete(group);
      touched.push(x.canonicalSurface);
    }
    return touched.length ? foldGroups(st, [], touched) : st;
  },
);

/**
 * Recurrence earns an identity hypothesis, never timeless sameness.
 */
export function descriptorHypotheses(graphEntries = []) {
  return surfaceState(graphEntries).frozen;
}

/**
 * The same hypotheses over the FOLD's occurrences plus a handful of
 * not-yet-folded ones — the per-encounter shape reviseTextFold needs. The
 * fold side rides the chain view; the extras touch a few groups, which are
 * read copy-on-read so the shared state is never written with entries the
 * fold does not yet hold. Output order is the original combined-array
 * semantics: fold-known surfaces in first-occurrence order, new-only
 * surfaces appended in arrival order.
 */
const NOTHING = Object.freeze([]);
/**
 * `changedOnly` (2026-09-07): the hypotheses that could have CHANGED since
 * this state was last asked — every surface a delta touched since then
 * (`pending`, kept by foldGroups), plus the surfaces this sentence's extras
 * touch — fold-known ones in first-occurrence order, new-only ones in
 * arrival order; and the whole list the first time a state is asked (a
 * state just computed from scratch has offered nothing yet). revision.js
 * admits hypotheses whose ids the fold lacks and ignores the rest; profiled
 * at 480 KB it walked every hypothesis every sentence to find the few that
 * were new (8.5% of the read, growing 36x for 2x the sentences).
 *
 * THE FIRST CUT WAS WRONG AND THE GATE CAUGHT IT. It offered only the
 * extras' surfaces, on the argument that an append arrives only as an
 * extra. It does not: an occurrence also enters the fold through the
 * observation's own graphEntries, never through revision's extras, and a
 * group grown that way was never offered — the 60 KB log hash moved while
 * the nodes stayed. `pending` closes that route: any group changed by any
 * delta since the last ask is offered at the next one. `fresh` and
 * `pending` are consumed by the `changedOnly` asker and by nobody else.
 */
export function descriptorHypothesesWith(foldEntries = [], extraOccurrences = [], { changedOnly = false } = {}) {
  const st = surfaceState(foldEntries);
  const offerAll = !changedOnly || st.fresh;
  const carried = st.pending;
  if (changedOnly) { st.fresh = false; st.pending = new Set(); }
  const extra = new Map(); // surface -> the group as it would be with the extras (a copy), in extras' arrival order
  for (const x of extraOccurrences) {
    if (x?.schema !== "EOReferentOccurrence@1") continue;
    const key = x.canonicalSurface;
    if (!extra.has(key)) extra.set(key, [...(st.groups.get(key) ?? [])]);
    extra.get(key).push(x);
  }
  if (!offerAll) {
    const touched = new Set([...carried, ...extra.keys()]);
    if (!touched.size) return NOTHING;
    const known = [...touched].filter((k) => st.order.has(k)).sort((a, b) => st.order.get(a) - st.order.get(b));
    const fresh = [...touched].filter((k) => !st.order.has(k));
    const out = [];
    for (const key of [...known, ...fresh]) { const h = hypothesisForGroup(key, extra.get(key) ?? st.groups.get(key)); if (h) out.push(h); }
    return Object.freeze(out);
  }
  if (!extra.size) return st.frozen;
  const known = [...extra.keys()].filter((k) => st.order.has(k)).sort((a, b) => st.order.get(a) - st.order.get(b));
  const fresh = [...extra.keys()].filter((k) => !st.order.has(k));
  // Fold-known surfaces: walk `out` in order, replacing or inserting the touched ones at their first-occurrence positions.
  const out = [];
  let k = 0;
  const pushKnown = (limitOrder) => { while (k < known.length && st.order.get(known[k]) < limitOrder) { const h = hypothesisForGroup(known[k], extra.get(known[k])); if (h) out.push(h); k += 1; } };
  for (let i = 0; i < st.out.length; i += 1) {
    const o = st.outOrder[i];
    pushKnown(o);
    if (k < known.length && st.order.get(known[k]) === o) { const h = hypothesisForGroup(known[k], extra.get(known[k])); if (h) out.push(h); k += 1; }
    else out.push(st.out[i]);
  }
  pushKnown(Infinity);
  for (const key of fresh) { const h = hypothesisForGroup(key, extra.get(key)); if (h) out.push(h); }
  return Object.freeze(out);
}

function hypothesesFrom(bySurface) {
  const hypotheses = [];
  for (const [surface, group] of bySurface) {
    if (group.length < 2) continue;
    const encounterRefs = [...new Set(group.map((x) => x.encounterRef).filter(Boolean))];
    if (encounterRefs.length < 2) continue;
    const determinations = [...new Set(group.map((x) => x.determination).filter(Boolean))];
    hypotheses.push(Object.freeze({
      schema: "EOIdentityHypothesis@1",
      id: `identity:descriptor:${slug(surface)}`,
      surface,
      determinations: Object.freeze(determinations),
      occurrenceRefs: Object.freeze(group.map((x) => x.id)),
      encounterRefs: Object.freeze(encounterRefs),
      relationContexts: Object.freeze(group.map((x) => ({ edge: x.edge, relation: x.relation, role: x.role }))),
      standing: "live_hypothesis",
      provenance: Object.freeze({
        giver: "text/individuation::descriptorHypotheses",
        basis: "same descriptor recurred across distinct encounters; identity remains defeasible",
      }),
    }));
  }
  return Object.freeze(hypotheses);
}


/**
 * Project the Fold's present best referential commitment from an identity
 * hypothesis. This is deliberately REVERSIBLE.
 *
 * Repeated indefinite descriptions ("a servant", "a boat") do not imply one
 * being and are never canonicalised by recurrence alone. Repeated definite or
 * possessive descriptions carry a weak received language prior that the
 * discourse treats their target as identifiable. We may therefore expose a
 * provisional current referent while retaining every occurrence and the live
 * identity hypothesis that justified it. Later witness can SEG or DEF this
 * projection without changing the historical observations.
 */
export function referentFromDescriptorHypothesis(hypothesis) {
  if (hypothesis?.schema !== "EOIdentityHypothesis@1") return null;
  const determinations = new Set(hypothesis.determinations ?? []);
  if (!determinations.has("definite") && !determinations.has("possessive")) return null;
  return Object.freeze({
    schema: "EOReferent@1",
    id: `ref:descriptor:${slug(hypothesis.surface)}`,
    display: hypothesis.surface,
    surfaces: Object.freeze([hypothesis.surface]),
    occurrenceRefs: Object.freeze([...(hypothesis.occurrenceRefs ?? [])]),
    identityHypothesis: hypothesis.id,
    standing: "provisional",
    revisable: true,
    provenance: Object.freeze({
      giver: "text/individuation::referentFromDescriptorHypothesis",
      basis: "recurrent definite/possessive discourse reference; defeasible until challenged",
    }),
  });
}
