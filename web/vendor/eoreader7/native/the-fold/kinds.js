// kinds.js — THE MATERIAL'S KINDS, INDUCED BY THE ENGINE'S OWN ORGAN
// (2026-09-21). The user: "I don't think we're using the terrain extraction
// and kind induction properly … we can instantly summarize something with EOT
// and a few choice linked spans." The arrangement grouped statements with
// hand-built heuristics (shared beings, word overlap) while the engine already
// holds a kind inducer (kernel/kind-induction.js + entity-kind-induction.js:
// capacities `kinds` and `kindnull`, Kind terrain) that finds basins in an
// affinity field and tests each against a random-subset binding null.
//
// Here every drafted STATEMENT is an entity. Its evidence is structural and
// general, never a topic list:
//   label     the capitalised word a statement opens on when an enumerator
//             follows it ("Observation B,", "Recommendation D.1,", "Item 3:")
//             — a shape, not a vocabulary;
//   predicate the lemma at the root of its parse (EOTRich), when parsed;
//   subject   the lemma of the root's subject, when parsed;
//   being     each proper referent it names (referents.js).
// The organ decides which statements form a kind; this module only renders
// what it found: the kind stated once, and a few of its instances chosen by
// SATURATION — the instance that shows the most beings and figures not yet
// shown, until the next shows none — each linked to its exact bytes.

import { kindEvidence, createKindInductionIndex, indexKindEntries } from "../kernel/kind-induction.js";
import { induceEntityKindCandidates } from "../kernel/entity-kind-induction.js";
import { drawnParts } from "./eot-draft.js";
import { isProperReferent } from "./referents.js";

export const KIND_SCHEMA = "EOStatementKinds@1";

const LABEL = /^\s*(?:the\s+)?(\p{Lu}[\p{Ll}-]+)\s+(?:[A-Z](?:\.\d+)*|\d+(?:\.\d+)*|[IVXLC]+)\b\s*[,.:;—–-]/u;

/** The label a statement opens on, when an enumerator follows it. */
export function labelOf(text) {
  const m = String(text ?? "").match(LABEL);
  return m ? m[1].toLowerCase() : null;
}

function rootOf(pt) {
  for (const r of pt.eot ?? []) {
    const m = r.meaning;
    if (!m?.nodes?.length) continue;
    const by = new Map(m.nodes.map((n) => [n.key, n]));
    const root = (m.arcs ?? []).find((a) => a.from == null);
    if (!root) continue;
    const subj = (m.arcs ?? []).find((a) => a.from === root.to && /^nsubj/.test(a.rel));
    return { predicate: by.get(root.to)?.lemma?.toLowerCase() ?? null, subject: subj ? by.get(subj.to)?.lemma?.toLowerCase() ?? null : null };
  }
  return { predicate: null, subject: null };
}

const figuresOf = (t) => new Set(String(t ?? "").match(/\d[\d,.:]*\d|\d/g) ?? []);

/**
 * statementKinds(draft) → { schema, kinds, diagnostics }
 * kinds: [{ key, members: [statementId], label, core: [{key, value}], pValue, cleared }]
 */
export function statementKinds(draft, { population = null } = {}) {
  const R = draft?.referents ?? null;
  const points = drawnParts(draft).flatMap((p) => p.children.map((pt) => ({ ...pt, part: p.id })));
  const entries = [];
  let seq = 0;
  // sequencePosition is the statement's place in the material: the organ
  // refuses evidence without one (it orders what is witnessed when).
  const pos = new Map(points.map((pt, i) => [pt.id, i]));
  const ev = (pt, featureKey, featureValue) => entries.push(kindEvidence({ id: `ke-${++seq}`, entityRef: pt.id, featureKey, featureValue, sequencePosition: pos.get(pt.id), witness: pt.id, anchor: { start: pt.span.start, end: pt.span.end } }));
  for (const pt of points) {
    const label = labelOf(pt.text);
    if (label) ev(pt, "label", label);
    const { predicate, subject } = rootOf(pt);
    if (predicate) ev(pt, "predicate", predicate);
    if (subject) ev(pt, "subject", subject);
    if (R) for (const id of R.resolveText(pt.text)) if (isProperReferent(R, id)) ev(pt, "being", id);
  }
  const index = createKindInductionIndex();
  indexKindEntries(index, entries);
  const induced = induceEntityKindCandidates(index.entityFeatures, { population: population ?? `statements:${draft?.sourceId ?? "draft"}` });
  const text = new Map(points.map((pt) => [pt.id, pt.text]));
  const kinds = induced.candidates.map((c) => {
    const members = [...c.memberRefs].sort((a, b) => points.findIndex((p) => p.id === a) - points.findIndex((p) => p.id === b));
    const labels = members.map((id) => labelOf(text.get(id))).filter(Boolean);
    const label = labels.length * 2 > members.length ? mode(labels) : null;
    return {
      key: c.kindKey, members, label,
      core: (c.distinguishingParameters ?? c.parameters ?? []).slice?.(0, 6)?.map?.((p) => ({ key: p.featureKey ?? p.key, value: p.featureValue ?? p.value })) ?? [],
      pValue: c.cohesionNull?.pValue ?? null, cleared: c.cohesionNull?.passed ?? null,
    };
  });
  return { schema: KIND_SCHEMA, kinds, diagnostics: induced.diagnostics, evidence: entries.length };
}

function mode(xs) { const c = new Map(); for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1); return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]; }

/**
 * saturatingSpans(ids, draft) → the instances to quote: each next one is the
 * statement showing the most beings and figures not yet shown; stop when the
 * next would show none. The material decides how many.
 */
export function saturatingSpans(ids, draft) {
  const R = draft?.referents ?? null;
  const pts = new Map(drawnParts(draft).flatMap((p) => p.children.map((pt) => [pt.id, pt])));
  // Beings here are PROPER beings only — the same bar statementKinds'
  // own evidence loop holds two screens up (isProperReferent). Generic
  // descriptor referents (ref:descriptor:, determiner + recurrence) resolve
  // asks but never individuate: counting them as quotable novelty lets a
  // ubiquitous "the exhibit" outbid a proper being for first quote and
  // demotes the higher-gain statement to redundant (measured 2026-09-30:
  // [p2.1,p2.2,p2.3] became [p1.1,p2.2,p2.3] with identical saturation).
  const marks = (pt) => new Set([...(R ? [...R.resolveText(pt.text)].filter((x) => isProperReferent(R, x)).map((x) => `b:${x}`) : []), ...[...figuresOf(pt.text)].map((f) => `f:${f}`)]);
  const shown = new Set();
  const left = ids.filter((id) => pts.has(id));
  const out = [];
  while (left.length) {
    let best = -1, gain = 0;
    left.forEach((id, i) => { const g = [...marks(pts.get(id))].filter((m) => !shown.has(m)).length; if (g > gain) { gain = g; best = i; } });
    if (best < 0) break;
    const id = left.splice(best, 1)[0];
    for (const m of marks(pts.get(id))) shown.add(m);
    out.push({ id, text: pts.get(id).text, span: { ...pts.get(id).span } });
  }
  return out.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const plural = (w) => (/(s|x|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);

/** The kind, stated once, in plain words: "six observations". English-scoped. */
export function kindSentence(kind) {
  const n = kind.members.length;
  if (!kind.label) return null;
  return `${NUMBER_WORDS[n] ?? n} ${n === 1 ? kind.label : plural(kind.label)}`;
}
