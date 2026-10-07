// arrange.js — THE FIRST PASS AT AN ESSAY'S SHAPE, COMPOSED FROM THE SOURCES
// RATHER THAN COPIED FROM THEM (2026-09-21).
//
// The user: "have it try, on its first pass, to mimic the best practice of
// structure of an essay using the holographic information we have, but using
// reasoning linking to make sure that we are not saying something illogical."
//
// Until now the draft's outline was the source's own paragraphs, in the
// source's own order — which looked right only because the test source was a
// tidy summary already shaped like an essay. Real research is several
// documents that overlap, disagree in order, and are laid out for their own
// purposes. This module composes an outline instead, with no model:
//
//   THESIS   the general statement — no date, no figure — whose words recur
//            across the most parts of the material. It is the one claim the
//            whole is holographically about: every part carries some of it.
//   BODY     the statements regrouped by the BEINGS they name beyond the
//            subject, across sources (a being two sources both name belongs to
//            one group), each group ordered by its EXTENT — the dates it
//            carries — with undated groups kept where the material put them.
//   TENSION  a group the material itself marks as a turn (a contrastive
//            connective opens one of its statements). Where the material marks
//            none, the slot is a declared gap, never invented.
//   RETURN   a slot for the close, which must come back to the thesis.
//
// And the REASONING CHECKS, each attributed to the organ or archon that owns
// the kind of error:
//   - every body group must bear on the thesis (shares a being or a word with
//     it), or it is a part with no job in this argument (Clark);
//   - consecutive groups are linked as SUCCESSION (the later begins where the
//     earlier ends), OVERLAP, or flagged as an INVERSION (it goes back in time
//     with nothing marking the return) — the extent is the Ground;
//   - two statements giving DIFFERENT figures for the same relation between
//     the same beings are a conflict, never silently merged (Kelsen);
//   - a circular chain of claims is found by Kelsen's own cycle finder over
//     notes built from the parse trees (organs/reasoning-lint.js).
//
// It works with or without the parsed EOT trees and the referent resolver on
// the draft; each absent input weakens a check and the outline says which.

import { drawnParts, draftWords } from "./eot-draft.js";
import { findClaimCycle } from "../organs/reasoning-lint.js";
import { isProperReferent } from "./referents.js";
import { measureVariance } from "./admission.js";
import { findDuplicateStatements } from "./restatement.js";
import { askedExtent as askedExtentOf } from "./void-spec.js";
import { isFunctionWord } from "./pos-prior.js";
import { thesisBasin, thesisGeneralization } from "./thesis-claim.js";
import { renderGeneralization, claimFromTriple, holon } from "../kernel/gfp-claim.js";
import { makeNotes } from "../kernel/notes.js";
import { loadBearingChecker } from "./claim-dependencies.js";

export const OUTLINE_SCHEMA = "EOEssayOutline@2";

const THIS_YEAR = new Date().getUTCFullYear();

/** The dates a statement carries: four-digit years and decades ("1850s",
 *  "the 1920s"), and "today"/"now" read as the present. Its EXTENT. */
export function extentOf(text) {
  const t = String(text ?? "");
  const years = [];
  for (const m of t.matchAll(/\b(1[0-9]{3}|20[0-9]{2})(s)?\b/g)) years.push(Number(m[1]) + (m[2] ? 5 : 0));
  if (/\b(today|now|nowadays|currently)\b/i.test(t)) years.push(THIS_YEAR);
  return years;
}
// A FIGURE is a quantity or a date, not an ordinal inside a word ("the
// 20th-century physics" — the falsifier's case disqualified a real thesis).
const hasFigure = (t) => /\d/.test(String(t ?? "").replace(/\b\d+(st|nd|rd|th)\b/gi, ""));
// A turn the material itself marks: a contrastive connective at a statement's
// start. English-scoped, and a closed grammatical class, not a topic list.
const CONTRAST = /^\s*(but|however|yet|still|although|though|even though|even so|nevertheless|despite|in contrast|on the other hand)\b/i;

/** Relation notes from the parse trees: the root's subject, the root, and its
 *  object or oblique — the claim graph Kelsen's cycle finder walks. */
function notesOf(pt) {
  const out = [];
  for (const r of pt.eot ?? []) {
    const m = r.meaning;
    if (!m?.nodes?.length) continue;
    const byKey = new Map(m.nodes.map((n) => [n.key, n]));
    const rootArc = (m.arcs ?? []).find((a) => a.from == null);
    const root = rootArc ? byKey.get(rootArc.to) : null;
    if (!root) continue;
    const arcs = (m.arcs ?? []).filter((a) => a.from === root.key);
    const subj = arcs.find((a) => /^nsubj/.test(a.rel));
    const obj = arcs.find((a) => a.rel === "obj") ?? arcs.find((a) => a.rel === "obl");
    const cop = arcs.find((a) => a.rel === "cop");
    // ADJ ROOT ONLY, NEVER A BARE NOUN ROOT (corrected same-day: the first
    // version of this gate required a literal `cop` arc, which this parser
    // does not emit for predicate adjectives -- the real sentence that
    // motivated this, "Freedom of speech ... is not absolute.", has root
    // "absolute" with only nsubj/advmod children, no cop node at all.
    // Loosening to "any non-verb root" was considered and rejected: this
    // session's own science-domain falsification found a genuine parser
    // root-selection ERROR also lands on a non-verb root -- a bare NOUN --
    // so admitting any non-verb root here would manufacture a false claim
    // from that exact error. A predicate ADJECTIVE cannot take an object by
    // grammatical definition, whether or not this parser encodes an
    // explicit copula for it; a bare NOUN root stays excluded.
    const predicateAdj = root.upos === "ADJ";
    if (!subj) continue;
    if (!obj && !cop && !predicateAdj) continue;
    // POLARITY (2026-09-25, the reading archons, twice): the parser's own
    // declared Neg feature — Polarity=Neg on "not", "neither", "nor";
    // PronType=Neg on "never", "no", "nothing" — never a word list. Read where
    // a negation denies THIS note: an advmod of the root, the subject node,
    // the object node, a marker on either, a conjunct of the object or its
    // markers. A Neg anywhere else in the sentence leaves the note
    // UNRESOLVED ("?"): under-cited, never mis-cited. VIA: an object, or an
    // oblique with its case marker ("obl:through"), so "flowed through" and
    // "flowed past" are never one relation to a generalization. PRT: a
    // phrasal particle (compound:prt), kept beside `label` — id, end1, label
    // and end2 are unchanged for the cycle finder and the figure check.
    const isNeg = (feats) => (feats ?? []).some((f) => f.value === "Neg" && (f.name === "Polarity" || f.name === "PronType"));
    const markersOn = (node) => (m.markers ?? []).filter((x) => (node?.markers ?? []).includes(x.key));
    const subjNode = byKey.get(subj.to);
    const objNode = obj ? byKey.get(obj.to) : null;
    const conjuncts = obj ? (m.arcs ?? []).filter((a) => a.from === obj.to && a.rel === "conj").map((a) => byKey.get(a.to)).filter(Boolean) : [];
    const negHere = [...arcs.filter((a) => a.rel === "advmod").map((a) => byKey.get(a.to)), subjNode, objNode, ...conjuncts]
      .filter(Boolean).some((n) => isNeg(n.feats) || markersOn(n).some((x) => isNeg(x.feats)));
    const negAnywhere = m.nodes.some((n) => isNeg(n.feats)) || (m.markers ?? []).some((x) => isNeg(x.feats));
    const caseMark = obj && obj.rel === "obl" ? markersOn(objNode).find((x) => x.rel === "case")?.lemma : null;
    const prt = arcs.find((a) => a.rel === "compound:prt");
    // COPULAR CLAIMS (2026-09-26, falsified live on real legal-register
    // content: a correctly-parsed predicate-adjective sentence, "Freedom of
    // speech ... is not absolute.", produced ZERO notes under the SVO-only
    // rule above -- a predicate adjective/nominal has no object arc by
    // grammatical construction, not a parse failure). A copular claim's own
    // "object" is the root itself (the predicate the subject is asserted to
    // be); the relation label is the copula's own lemma, read from the
    // parse, never invented -- distinguished from a transitive relation by
    // `via: "pred"` so a generalization never conflates "X holds Y" with
    // "X is Y" on a coincidentally-shared lemma.
    const label = obj ? root.lemma : ((cop && byKey.get(cop.to)?.lemma) ?? "be");
    const end2 = obj ? objNode?.lemma : root.lemma;
    const via = obj ? (obj.rel === "obl" ? `obl:${caseMark ?? ""}` : "obj") : "pred";
    out.push({
      id: `${pt.id}:${root.key}`, end1: subjNode?.lemma, label, end2, witness: pt.id,
      polarity: negHere ? "-" : negAnywhere ? "?" : "+", via, prt: prt ? (byKey.get(prt.to)?.lemma ?? null) : null,
    });
  }
  return out;
}

/**
 * claimsFromFeat(feat) -> { claims, unresolved }
 *
 * The general bridge from arrangeEssay's own always-run per-point extraction
 * to real, holon-addressed GFP claims (the-fold/fold-at.js's own cursor
 * addressing) -- built 2026-09-26 after finding thesis-claim.js's own claim-
 * producing branch (the-fold/thesis-claim.js's thesisGeneralization) real but
 * measured at zero activations across nine real documents (this file's own
 * comments, above). feat and notesOf() run over EVERY point in EVERY
 * arrangeEssay call, unconditionally -- not just thesis winners -- so this
 * is the commonly-populated path, not the rare one.
 *
 * Each point's own notesOf() output (already computed as f.notes) already
 * carries a real subject/relation/object triple and a declared polarity;
 * this reuses it rather than re-deriving anything. gfp-claim.js's gfpClaim
 * only accepts polarity "+" or "-" (checked against its own source before
 * writing this); notesOf's own third state, "?" (POLARITY UNRESOLVED --
 * a Neg feature found somewhere in the sentence but not on this note's own
 * subject/object/root), cannot become either without inventing certainty
 * the parser itself declined to assert. Those notes are excluded from
 * `claims` and counted in `unresolved`, never silently dropped and never
 * coerced to a guessed polarity.
 */
export function claimsFromFeat(feat) {
  const claims = [];
  let unresolved = 0;
  for (const f of feat) {
    for (const note of f.notes ?? []) {
      if (note.polarity === "?") { unresolved++; continue; }
      if (!note.end1 || !note.label || !note.end2) continue;
      claims.push(claimFromTriple(note.end1, note.label, note.end2, {
        ground: holon(f.pt.path ?? `/${f.pt.part}`),
        id: note.id,
        polarity: note.polarity,
      }));
    }
  }
  return { claims, unresolved };
}

export function arrangeEssay({ draft, spec = null, exclude = null, roleVocabulary = null, pValue = null } = {}) {
  const parts = drawnParts(draft);
  // RECOMPOSITION (skeleton-loop.js, stage 7): a statement a finding licensed
  // out of the skeleton is left out of the material the next loop composes
  // from — the outline is rebuilt, never patched.
  const left = exclude instanceof Set ? exclude : new Set(exclude ?? []);
  const points = parts.flatMap((p) => (p.children ?? []).filter((pt) => !left.has(pt.id)).map((pt) => ({ ...pt, part: p.id })));
  // ONE FACT, ONE STATEMENT: two sources stating the same fact (an agenda and
  // its minutes both giving the meeting's date, time and room) would be said
  // twice. The poorer statement leaves the outline (restatement.js,
  // containment of figures AND names, bare numbers null-filtered).
  const duplicates = findDuplicateStatements(points.map((pt) => ({ text: pt.text, id: pt.id })));
  // FETCHED MATERIAL NEVER OUTRANKS THE OPERATOR'S (hunt.js, tier 0 vs 1):
  // where the richer of two duplicate statements is the fetched one, the
  // operator's stands and the fetched one leaves — however much richer.
  const tierOf = new Map(parts.flatMap((p) => (p.children ?? []).map((pt) => [pt.id, p.tier ?? 0])));
  for (const d of duplicates) {
    if ((tierOf.get(d.keep) ?? 0) > (tierOf.get(d.drop) ?? 0)) {
      [d.keep, d.drop, d.keepText, d.dropText] = [d.drop, d.keep, d.dropText, d.keepText];
      d.tiered = true;
    }
  }
  const dropped = new Set(duplicates.map((d) => d.drop));
  const R = draft?.referents ?? null;
  const subject = draft?.subjectRefs ?? new Set();
  const weakened = [];
  if (!R) weakened.push("no referent resolver on the draft: groups are formed from words, not beings");
  if (!points.some((pt) => (pt.eot ?? []).length)) weakened.push("no parse trees on the draft: the cycle check has no claim graph");

  // ── features of every statement
  const partWords = new Map(parts.map((p) => [p.id, new Set(draftWords(p.text))]));
  // A month or a present-time word is EXTENT, not a being ("May" in "May
  // 2010", "Today" opening a sentence) — a closed grammatical class.
  const EXTENT_WORD = /^(today|now|yesterday|tomorrow|january|february|march|april|may|june|july|august|september|october|november|december)$/i;
  const isBeing = (id) => !EXTENT_WORD.test(String(R?.represent(id) ?? "").trim());
  const feat = points.filter((pt) => !dropped.has(pt.id)).map((pt) => {
    const all = R ? [...R.resolveText(pt.text)].filter(isBeing) : [];
    const beings = all.filter((id) => !subject.has(id));
    const words = [...new Set(draftWords(pt.text))];
    const years = extentOf(pt.text);
    return { pt, beings, all, words, years, general: !hasFigure(pt.text), contrast: CONTRAST.test(pt.text), notes: notesOf(pt) };
  });

  // ── THESIS: the general statement whose words recur across the most parts
  const recur = (f) => {
    if (!f.words.length) return 0;
    const reach = f.words.map((w) => parts.filter((p) => partWords.get(p.id).has(w)).length / parts.length);
    return reach.reduce((a, b) => a + b, 0) / reach.length;
  };
  // A thesis is GENERAL: no figure, not itself a turn (a "But …" sentence is
  // the tension, not the claim), and it names no proper being beyond the
  // subject — a sentence about the protagonist is a Figure of the story, not
  // its Ground (falsifier: "General Elena Marsh led the besieging force" beat
  // the real thesis because Marsh recurs).
  // THE MATERIAL'S GROUND, MEASURED (the same exact null admission.js uses
  // for words): a being named in k statements, scattered at random over N
  // parts, would occupy N·(1−(1−1/N)^k) of them. A being occupying at least
  // that many is spread as widely as chance allows — the whole material is
  // about it, so it joins no section and may stand in the thesis. Only a
  // CONCENTRATED being is one section's figure. (OHS, 2026-09-21: "Office of
  // Homeless Services" and "Homeless Impact Division" chained 69 of 78
  // sentences into one section.)
  const N = parts.length;
  const kOf = new Map(), partsOf = new Map();
  for (const f of feat) for (const id of new Set(f.beings)) {
    kOf.set(id, (kOf.get(id) ?? 0) + 1);
    if (!partsOf.has(id)) partsOf.set(id, new Set());
    partsOf.get(id).add(f.pt.part);
  }
  // Not the expectation alone — a TEST: the exact occupancy distribution
  // gives P(D ≤ seen) for k mentions over N parts, and a being is
  // concentrated only when that is at most 1/N, the level at which about one
  // chance join is expected across the whole material. (Measured: with the
  // bare expectation "Metropolitan" — 10 mentions, 8 of 22 parts, chance
  // 8.2 — counted as concentrated and chained seven parts.)
  const pAtMost = (k, n, seen) => {
    let dp = new Array(n + 1).fill(0); dp[0] = 1;
    for (let t = 0; t < k; t++) {
      const nx = new Array(n + 1).fill(0);
      for (let j = 0; j <= n; j++) if (dp[j]) { nx[j] += dp[j] * (j / n); if (j < n) nx[j + 1] += dp[j] * ((n - j) / n); }
      dp = nx;
    }
    return dp.slice(0, seen + 1).reduce((a, b) => a + b, 0);
  };
  // A SECOND WITNESS: WHERE the being appears. Named once per paragraph, its
  // mentions never cluster (k = seen, P = 1 for every N — falsifier), yet a
  // local figure sits in CONSECUTIVE paragraphs. The runs test is exact:
  // choosing `seen` of N ordered parts at random forms exactly r runs in
  // C(seen−1, r−1)·C(N−seen+1, r) of C(N, seen) ways. Same level, 1/N.
  // ("EPA" in 3 adjacent of 26 paragraphs: P ≈ 0.009 — concentrated.)
  const lnC = (n, r) => { if (r < 0 || r > n) return -Infinity; let x = 0; for (let i = 1; i <= r; i++) x += Math.log(n - r + i) - Math.log(i); return x; };
  const partIndex = new Map(parts.map((p, i) => [p.id, i]));
  const runsAtMost = (idxs) => {
    const sorted = [...idxs].sort((a, b) => a - b);
    const m = sorted.length;
    let runs = m ? 1 : 0; for (let i = 1; i < m; i++) if (sorted[i] !== sorted[i - 1] + 1) runs++;
    const total = lnC(N, m);
    let p = 0; for (let r = 1; r <= runs; r++) p += Math.exp(lnC(m - 1, r - 1) + lnC(N - m + 1, r) - total);
    return p;
  };
  // Each null licenses what it measured. Concentrated by MENTIONS (clustered
  // beyond chance) → may join parts anywhere in the material. Concentrated
  // only by POSITION (the runs test) → joins ADJACENT parts only: a being
  // filling long consecutive runs is the ground of one document ("Homeless
  // Impact Division" through the whole 2023 audit), and letting it join at a
  // distance made one 105-statement section (measured, OHS).
  const byMentions = (id) => { const k = kOf.get(id) ?? 0; return N >= 2 && k >= 2 && pAtMost(k, N, partsOf.get(id)?.size ?? 0) <= 1 / N; };
  const byPosition = (id) => { const k = kOf.get(id) ?? 0; const seen = partsOf.get(id)?.size ?? 0; return N >= 2 && k >= 2 && seen >= 2 && seen < N && runsAtMost([...partsOf.get(id)].map((p) => partIndex.get(p))) <= 1 / N; };
  const concentrated = (id) => byMentions(id) || byPosition(id);
  const spread = new Set([...kOf.keys()].filter((id) => !concentrated(id)));
  const namesBeyondSubject = (f) => R ? f.beings.some((id) => isProperReferent(R, id) && !spread.has(id)) : false;
  const strict = feat.filter((f) => f.general && !f.contrast && !namesBeyondSubject(f));
  // Low before high: when no statement meets the strict bar (a weak subject
  // leaves every general sentence naming "someone else"), the bar relaxes to
  // general-and-not-a-turn, and the outline says so rather than going empty.
  let pool = strict.length ? strict : feat.filter((f) => f.general && !f.contrast);
  if (!strict.length && pool.length) weakened.push("no general statement names only the subject; the thesis was chosen among general statements that name other beings");
  // THE THESIS IS THE OPERATOR'S (hunt.js tiers): a fetched sentence may not
  // be the claim the whole piece makes while the operator's material holds
  // any candidate (measured live 2026-09-22: a fetched heading, "Nashville &
  // History", became the thesis).
  const own = pool.filter((f) => (tierOf.get(f.pt.id) ?? 0) === 0);
  if (own.length) pool = own;
  const candidates = pool.map((f) => ({ f, score: recur(f) })).sort((a, b) => b.score - a.score || a.f.pt.span.start - b.f.pt.span.start);
  const thesis = candidates[0]?.f ?? null;
  // SEVERAL CANDIDATES, ONE CLAIM (thesis-claim.js, 2026-09-25): when the
  // pool's candidates form a null-validated basin (the engine's own kind
  // inducer, over each candidate's predicate lemma) that contains today's
  // winner, and at least two of the winner's group share a relation AND a
  // polarity AND agree on at least one role, a generalized claim stands
  // BESIDE the winner — the roles they agree on, the rest disclosed as
  // varying. The winner's own sentence stays the thesis's text in every
  // case; the claim is an additive fact. Anything short of that is a
  // disclosed refusal, never a silent fallback. (Measured 2026-09-25 across
  // NINE real grounds — a house doc, two UD treebank READMEs, an OHS audit,
  // a Call of the Wild excerpt, UK legislation, a SCOTUS oral-argument
  // excerpt, the surf white paper, the Cumberland essay: zero basins
  // validate, including on the two grounds with real negation in their
  // noted clauses — Call of the Wild +21/−5/?4, the SCOTUS excerpt
  // +27/−5/?2 — so the gap is not merely rarity, it was not observed at all
  // on real prose. Real general sentences do not share a predicate lemma at
  // the kernel's prevalence floor; the path fires on refrains.)
  const hunt = thesis ? thesisBasin(pool, thesis.pt.id, { population: `thesis-pool:${draft?.sourceId ?? "draft"}` }) : null;
  const basin = hunt?.candidate ?? null;
  const basinMembers = basin ? pool.filter((f) => basin.memberRefs.includes(f.pt.id)) : [];
  // ONE SUBJECT (Kelsen), NARROWED (third reading, Orlean: a single
  // false-positive proper referent — an unseen sentence-initial common noun
  // read as proper by referents.js's own default, out of this change's
  // scope — collapsed four real witnesses to one when the guard refused the
  // whole basin). With a resolver, only members naming the SAME proper
  // beings as the WINNER are generalized; a member naming a different one is
  // EXCLUDED and NAMED in the basis (id and its differing beings), never
  // silently dropped and never fatal to the rest. Without a resolver the
  // guard does not run, and the basis says that.
  const properOf = (f) => (R ? [...new Set(f.all.filter((id) => isProperReferent(R, id)))].sort().join("\u0001") : "");
  const consistent = R ? basinMembers.filter((f) => properOf(f) === properOf(thesis)) : basinMembers;
  const guardExcluded = R ? basinMembers.filter((f) => !consistent.includes(f)).map((f) => ({ id: f.pt.id, beings: properOf(f) || "(none)" })) : [];
  const synth = !basin ? null : thesisGeneralization(consistent, { winnerId: thesis.pt.id });
  const gen = synth?.generalization ? synth : null;
  // THE MATERIAL'S ORDER, KEPT (typesetting is signal): the members stand in
  // the order the material gave them; the winner is `id` and the thesis
  // part's span, never moved to the front.
  const thesisMemberIds = new Set(feat.filter((f) => thesis && (f.pt.id === thesis.pt.id || (gen && gen.statements.includes(f.pt.id)))).map((f) => f.pt.id));
  // THE EXCLUSION, AND ITS OPEN CONTEST (the reading archons, 2026-09-25):
  // every thesis member is held out of the body groups below. McPhee, Gornick
  // and Lish would RESTORE: a member followed by other sentences in its
  // source paragraph is that paragraph's topic sentence and belongs to its
  // group (still a witness, in thesis.ids); a member that is its paragraph's
  // whole content is a refrain line and stays held out — the paragraph seam
  // decides, no threshold. Clark and Kidder & Todd hold the fold is right.
  // Not decided (third reading: McPhee argues the gate — "after one mouth
  // run on a refrain ground" — has no known trigger, since all nine measured
  // grounds were floor-decided; Clark and Kidder & Todd hold the fold is
  // right regardless; restoring a member also duplicates its sentence across
  // two parts, an open question this reading did not resolve). Left as a
  // disclosed, unbuilt contest rather than landed either way. Measured
  // 2026-09-25 across nine real grounds (above): zero basins fired, so the
  // exclusion is unexercised on real material either way.
  //
  // BOTH BASES COUNT THE DAMAGE (third reading, McPhee: the prior count
  // excluded the winner's own paragraph and claimed an opening-sentence loss
  // no matter where in the paragraph a member sat). Every thesis member,
  // winner included, whose source paragraph has other children costs that
  // paragraph a sentence; only when the member is the paragraph's FIRST
  // child does the paragraph lose its OPENING sentence specifically.
  const partOf = new Map(parts.flatMap((p) => (p.children ?? []).map((c) => [c.id, p])));
  const beheadedParts = new Set([...thesisMemberIds].map((id) => partOf.get(id)).filter((p) => p && (p.children ?? []).length > 1).map((p) => p.id));
  const openingLost = [...thesisMemberIds].filter((id) => { const p = partOf.get(id); return p && (p.children ?? []).length > 1 && p.children[0]?.id === id; }).length;

  // ── BODY: regroup by shared beings (union-find), across sources
  const parent = new Map(feat.map((f) => [f.pt.id, f.pt.id]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  // AN AUTHOR'S PARAGRAPH IS ONE GROUP: the seam is the writer's own grouping
  // (measured: splitting a paragraph by the beings each sentence names broke
  // the Cumberland's geography paragraph in two).
  for (const p of parts) {
    const ids = (p.children ?? []).map((c) => c.id).filter((id) => !thesisMemberIds.has(id));
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
  }
  // ACROSS PARAGRAPHS AND SOURCES, ONLY A SHARED PROPER BEING JOINS GROUPS.
  // A common-noun referent ("warehouses") would chain the 1850s port to the
  // present-day parkland; a proper name ("Old Hickory Dam") names one thing.
  // AND ONLY A BEING THE PART IS ABOUT. A name said once in passing is not
  // what a paragraph is about: "Lake Cumberland" named once in the naming
  // paragraph chained it to the dams paragraph, and the geography paragraph
  // came along through "Cumberland River" (measured 2026-09-21: one body
  // spanning 1750–1954). A part is about a being when it opens on it (the
  // topic-sentence position) or returns to it in a second statement —
  // positions and counts the material gives, no threshold set here.
  const aboutness = new Map();
  for (const p of parts) {
    const own = feat.filter((f) => f.pt.part === p.id && !thesisMemberIds.has(f.pt.id));
    const n = new Map();
    for (const f of own) for (const id of new Set(f.beings)) n.set(id, (n.get(id) ?? 0) + 1);
    const opening = new Set(own[0]?.beings ?? []);
    aboutness.set(p.id, new Set([...n.entries()].filter(([id, c]) => c > 1 || opening.has(id)).map(([id]) => id)));
  }
  const byBeing = new Map();
  const prevPart = new Map(feat.map((f) => [f.pt.id, f.pt.part]));
  for (const f of feat) {
    if (thesisMemberIds.has(f.pt.id)) continue;
    for (const id of f.beings) {
      if (R && !isProperReferent(R, id)) continue;
      if (spread.has(id)) continue;
      if (!aboutness.get(f.pt.part)?.has(id)) continue;
      const prev = byBeing.get(id);
      const near = prev && Math.abs(partIndex.get(prevPart.get(prev)) - partIndex.get(f.pt.part)) <= 1;
      if (prev && (byMentions(id) || near)) union(prev, f.pt.id);
      byBeing.set(id, f.pt.id);
    }
  }
  const groupsMap = new Map();
  for (const f of feat) {
    if (thesisMemberIds.has(f.pt.id)) continue;
    const g = find(f.pt.id);
    if (!groupsMap.has(g)) groupsMap.set(g, []);
    groupsMap.get(g).push(f);
  }
  const order = new Map(points.map((pt, i) => [pt.id, i]));
  let groups = [...groupsMap.values()].map((fs) => {
    fs.sort((a, b) => order.get(a.pt.id) - order.get(b.pt.id));
    const years = fs.flatMap((f) => f.years);
    return {
      statements: fs,
      first: order.get(fs[0].pt.id),
      from: years.length ? Math.min(...years) : null,
      to: years.length ? Math.max(...years) : null,
      beings: [...new Set(fs.flatMap((f) => f.beings))],
      contrast: fs.some((f) => f.contrast),
      sources: [...new Set(fs.map((f) => f.pt.part))],
    };
  });

  // ── SIZE: NO SECTION LARGER THAN THE MATERIAL'S LARGEST PARAGRAPH. Each
  // section becomes ONE part the mouth writes; the author's own largest
  // paragraph is the most the material shows one part carrying (measured,
  // not chosen). A larger section is split between its paragraphs at the
  // weakest seam — the adjacent pair sharing the fewest claim words —
  // recursively. (OHS: adjacency chained a whole document into 74
  // statements.)
  const maxPart = Math.max(1, ...parts.map((p) => (p.children ?? []).length));
  const cw = (fs) => new Set(fs.flatMap((f) => f.words).filter((w) => !isFunctionWord(w)));
  const jac = (a, b) => { const A = cw(a), B = cw(b); let n = 0; for (const w of A) if (B.has(w)) n++; const u = A.size + B.size - n; return u ? n / u : 0; };
  const splitGroup = (fs) => {
    if (fs.length <= maxPart) return [fs];
    const blocks = [];
    for (const f of fs) { const last = blocks.at(-1); if (last && last[0].pt.part === f.pt.part) last.push(f); else blocks.push([f]); }
    if (blocks.length < 2) return [fs];
    let at = 1, low = Infinity;
    for (let i = 1; i < blocks.length; i++) { const sm = jac(blocks.slice(0, i).flat(), blocks.slice(i).flat()); if (sm < low) { low = sm; at = i; } }
    return [...splitGroup(blocks.slice(0, at).flat()), ...splitGroup(blocks.slice(at).flat())];
  };
  const rebuild = (fs) => {
    const years = fs.flatMap((f) => f.years);
    return { statements: fs, first: order.get(fs[0].pt.id), from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null, beings: [...new Set(fs.flatMap((f) => f.beings))], contrast: fs.some((f) => f.contrast), sources: [...new Set(fs.map((f) => f.pt.part))] };
  };
  groups = groups.flatMap((g) => splitGroup(g.statements).map(rebuild));

  // ── ORDER: THE MATERIAL'S ORDER, REPAIRED ONLY WHERE IT GOES BACK IN TIME.
  // Group A must precede group B only when A ends strictly before B begins;
  // overlapping or undated groups keep the order the material gave them. So
  // a cause-and-response order the writer chose (the floods, then the dams
  // built against them) survives, and only a true inversion is repaired.
  groups.sort((a, b) => a.first - b.first);
  const before = (a, b) => a.to != null && b.from != null && a.to < b.from;
  const placed = [];
  const pending = [...groups];
  while (pending.length) {
    const i = pending.findIndex((g) => !pending.some((h) => h !== g && before(h, g)));
    placed.push(pending.splice(i < 0 ? 0 : i, 1)[0]);
  }
  groups = placed;

  // ── SECTIONS: MERGE NEIGHBOURS THAT BELONG TOGETHER, BY A MEASURED RULE.
  // Beings alone left the OHS material at 17 sections — its paragraphs, not
  // an essay's parts. Two ADJACENT groups merge when each is the other's
  // nearest group and their similarity beats the material's background (the
  // mean similarity over all pairs of groups). Similarity is the Jaccard
  // overlap of claim words — material words less the variance words spread
  // through the whole (admission.js measureVariance, an exact null). No
  // constant; when the ask names a number of parts, merging continues down
  // to it (the void's cardinality).
  const variance = measureVariance(drawnParts(draft).map((p) => p.text).join("\n\n"));
  const claimWords = (g) => new Set(g.statements.flatMap((f) => f.words).filter((w) => !variance.has(w) && !isFunctionWord(w)));
  const sim = (a, b) => { const A = claimWords(a), B = claimWords(b); let n = 0; for (const w of A) if (B.has(w)) n++; const u = A.size + B.size - n; return u ? n / u : 0; };
  const mergeTwo = (a, b) => {
    const statements = [...a.statements, ...b.statements].sort((x, y) => order.get(x.pt.id) - order.get(y.pt.id));
    const years = statements.flatMap((f) => f.years);
    return { statements, first: Math.min(a.first, b.first), from: years.length ? Math.min(...years) : null, to: years.length ? Math.max(...years) : null, beings: [...new Set([...a.beings, ...b.beings])], contrast: a.contrast || b.contrast, sources: [...new Set([...a.sources, ...b.sources])] };
  };
  const asked = spec?.levels?.whole?.cardinality?.basis === "asked" ? spec.levels.whole.cardinality.value : null;
  for (;;) {
    if (groups.length < 2) break;
    const S = groups.map((a) => groups.map((b) => (a === b ? -1 : sim(a, b))));
    const pairs = []; for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) pairs.push(S[i][j]);
    const background = pairs.reduce((x, y) => x + y, 0) / pairs.length;
    const nearest = (i) => S[i].indexOf(Math.max(...S[i]));
    let best = -1, bestSim = -1;
    for (let i = 0; i + 1 < groups.length; i++) {
      const mutual = nearest(i) === i + 1 && nearest(i + 1) === i;
      const need = asked != null && groups.length > asked ? true : mutual && S[i][i + 1] > background;
      if (need && S[i][i + 1] > bestSim) { bestSim = S[i][i + 1]; best = i; }
    }
    if (best < 0) break;
    groups.splice(best, 2, mergeTwo(groups[best], groups[best + 1]));
  }

  // ── TENSION: a group the material marks as a turn — a contrastive
  // connective; else (2026-09-25, twice repaired by the reading archons) a
  // statement that CONTRADICTS the thesis's own relation, bidirectionally:
  // the candidate's polarity must be the thesis's OPPOSITE (works whether
  // the thesis itself is '+' or '-' — Caro's tension-asymmetry finding), the
  // FULL relation must match (label+particle+case, the same string
  // thesisGeneralization keys on, not the bare label — Caro, Clark, Kidder &
  // Todd), and every role the thesis has an ANCHOR for must match (both
  // roles for a single witness; only the agreed role(s) for a generalized
  // claim, so an ARG0-varying claim anchors on ARG1 rather than matching the
  // verb lemma alone — Clark). A claim with no agreed role anchors nothing.
  const same = (a, b) => a != null && b != null && String(a).toLocaleLowerCase("und") === String(b).toLocaleLowerCase("und");
  const relationOf = (n) => `${n.label}${n.prt ? ` ${n.prt}` : ""}${n.via?.startsWith("obl:") ? `:${n.via.slice(4)}` : ""}`;
  const OPPOSITE = { "+": "-", "-": "+" };
  const thesisRelation = gen ? gen.relation : (thesis?.notes[0] ? relationOf(thesis.notes[0]) : null);
  const thesisPolarity = gen ? gen.polarity : (thesis?.notes[0]?.polarity ?? "+");
  const ANCHOR_END = { ARG0: "end1", ARG1: "end2" };
  const thesisAnchors = gen ? gen.generalization.agreed : (thesis?.notes[0] ? { ARG0: thesis.notes[0].end1, ARG1: thesis.notes[0].end2 } : {});
  const contradicts = (n) => Object.entries(thesisAnchors).every(([role, val]) => same(n[ANCHOR_END[role]], val));
  const denies = (f) => !thesisMemberIds.has(f.pt.id) && thesisRelation != null && Object.keys(thesisAnchors).length > 0
    && f.notes.some((n) => n.polarity !== "?" && n.polarity === OPPOSITE[thesisPolarity] && relationOf(n) === thesisRelation && contradicts(n));
  const denials = feat.filter(denies);
  const tension = groups.find((g) => g.contrast) ?? groups.find((g) => g.statements.some(denies)) ?? null;

  // ── REASONING CHECKS
  const findings = [];
  // Bearing on the thesis COUNTS THE SUBJECT: the thesis is about the subject,
  // so a group naming the subject's beings bears on it. (Measured false alarm:
  // the present-day port, which names Nashville, was called off-thesis.)
  // TWO TIERS (the operator's rule: a low bar admits, a separate high bar
  // licenses acting). The LICENSE to leave a group out is judged against the
  // winner's own words and beings plus what the generalization AGREED on;
  // the REPORT of bearing uses the union over every thesis member, because a
  // VARYING value is one the claim discloses it does not agree on (Clark,
  // 2026-09-25: counting varying values as thesis words silenced a licensed
  // leave-out, 1 → 0). With no generalization the two tiers are one set.
  // REPORT draws on the whole basin (third reading, Orlean: the one-subject
  // guard's own excluded member — a false-positive proper referent — still
  // supplied the only word connecting a real body paragraph to the thesis;
  // excluding it from the report too silently removed that paragraph). A
  // member the guard or the relation split left out of the generalization is
  // still a real, null-validated relative of the thesis; the LICENSE tier
  // below stays the winner's own words alone.
  const basinIds = new Set(basinMembers.map((f) => f.pt.id));
  const thesisFeats = feat.filter((f) => thesisMemberIds.has(f.pt.id) || basinIds.has(f.pt.id));
  const memberWords = new Set(thesisFeats.flatMap((f) => f.words));
  const memberBeings = new Set([...thesisFeats.flatMap((f) => f.all), ...subject]);
  // The license set is the winner's own — never the generalization's lemmas:
  // the stemmer keeps "shaped" while the lemma is "shape", and Clark measured
  // the lemma licensing a body noun no thesis member holds.
  const licenseWords = new Set(thesis?.words ?? []);
  const licenseBeings = new Set([...(thesis?.all ?? []), ...subject]);
  const varyingWords = new Set(gen ? Object.values(gen.generalization.varying).flat().flatMap((v) => draftWords(String(v))) : []);
  // WHAT A FINDING LICENSES (stage 7, skeleton-loop.js): an off-thesis group
  // that also answers none of the ask's questions may leave the skeleton
  // (Clark: every section earns its place); one that answers a question
  // stays and is only reported — the ask outranks the thesis.
  const askWords = new Set(draftWords(String(draft?.task ?? "").match(/\b(?:on|about|of|regarding|concerning)\s+(.+?)[.?!]*$/i)?.[1] ?? "").filter((w) => !isFunctionWord(w)));
  groups.forEach((g, i) => {
    const bearsOn = (words, beings) => g.statements.some((f) => f.all.some((id) => beings.has(id)) || f.words.some((w) => words.has(w)));
    const licensed = bearsOn(licenseWords, licenseBeings);
    if (thesis && !licensed) {
      const answers = g.statements.some((f) => f.words.some((w) => askWords.has(w)));
      const viaVarying = bearsOn(varyingWords, new Set());
      const viaMember = !viaVarying && bearsOn(memberWords, memberBeings);
      findings.push({
        kind: "off_thesis", owner: "Roy Peter Clark", group: i, statements: g.statements.map((f) => f.pt.id),
        licenses: answers || viaVarying || viaMember ? null : "leave-out",
        detail: viaVarying
          ? `group ${i + 1} shares nothing with the thesis's own sentence — it bears only on a value the claim discloses as varying; reported, not licensed`
          : viaMember
            ? `group ${i + 1} shares nothing with the thesis's own sentence — only a word of a thesis member the claim did not keep; reported, not licensed`
            : `group ${i + 1} shares no being or word with the thesis — a part with no job in this argument${answers ? "; it answers the ask, so it stays" : ""}`,
      });
    }
  });
  const anchorLine = Object.entries(thesisAnchors).map(([r, v]) => `${r}="${v}"`).join(", ");
  // THE TYPED CONTEST (2026-09-25, thesis-claim.js's owed item 4): a denial
  // matching the thesis's relation is reported above regardless; where its
  // own OBJECT was ALSO one a witnessed member actually asserted — an exact
  // triple match, never the generalization's own varying role, which
  // kernel/notes.js's noteId has no concept of — it becomes a real
  // CON·Figure·CONTESTED dispute, not only a string: a cut meeting its link
  // (kernel/notes.js, THE CUT). Each statement is its own witness/source
  // (verified directly this turn: admit() refuses a dispute when the link's
  // and the cut's witness share one source — "one perspective does not
  // testify on both sides" — and a document's own sourceId is that one
  // shared source for every statement in it; a statement's own id has no
  // such collision, since a document is many sayings, never one voice
  // testifying twice). A denial naming an object no member ever witnessed
  // meets no link, lands nothing further, and stays exactly the disclosure
  // above — that is the honest outcome, not a gap: nothing witnessed was
  // actually contradicted.
  const contested = [];
  if (denials.length) {
    const linkMembers = feat.filter((f) => thesisMemberIds.has(f.pt.id));
    const door = makeNotes();
    let ledger = door.createNotes();
    const spanOf = (f) => [{ ref: f.pt.id, start: f.pt.span.start, end: f.pt.span.end }];
    for (const f of linkMembers) {
      const n = f.notes.find((note) => note.polarity === thesisPolarity && relationOf(note) === thesisRelation);
      if (!n) continue;
      ledger = door.admit(ledger, [{ end1: n.end1, label: n.label, end2: n.end2, spans: spanOf(f) }], { witness: f.pt.id }).log;
    }
    for (const f of denials) {
      const n = f.notes.find((note) => note.polarity === OPPOSITE[thesisPolarity] && relationOf(note) === thesisRelation && contradicts(note));
      if (!n) continue;
      const r = door.admit(ledger, [{ end1: n.end1, label: n.label, end2: n.end2, polarity: "-", decider: f.pt.text, spans: spanOf(f) }], { witness: f.pt.id });
      ledger = r.log;
      for (const c of r.contests) contested.push({ statement: f.pt.id, source: c.source, id: c.id });
    }
  }
  const contestLine = contested.length
    ? `; ${contested.length} of them landed as a real CON·Figure·CONTESTED dispute (kernel/notes.js): ${contested.map((c) => c.statement).join(", ")}`
    : denials.length ? "; none meet a witnessed member's own exact claim, so none landed further (kernel/notes.js's CUT requires the identical object, not the generalization's varying role)" : "";
  if (denials.length) findings.push({ kind: "denied_relation", owner: "Kelsen (reasoning-lint.js)", statements: denials.map((f) => f.pt.id), licenses: null, contested: contested.length ? contested : undefined, detail: `${denials.length} statement(s) contradict the thesis's relation "${thesisRelation}" (${thesisPolarity})${anchorLine ? ` on ${anchorLine}` : ""}: ${denials.map((f) => f.pt.id).join(", ")} — the material's own contest, reported${tension && !tension.contrast ? "; taken as the turn" : ""}${contestLine}` });
  const links = [];
  for (let i = 1; i < groups.length; i++) {
    const a = groups[i - 1], b = groups[i];
    let kind = "unmarked";
    if (a.to != null && b.from != null) kind = b.from >= a.to ? "succession" : b.to != null && b.to >= a.from ? "overlap" : "inversion";
    links.push({ from: i - 1, to: i, kind });
    if (kind === "inversion") findings.push({ kind: "inversion", owner: "the extent (Ground)", group: i, detail: `group ${i + 1} (${b.from}–${b.to}) goes back before group ${i} (${a.from}–${a.to}) with nothing marking the return` });
  }
  // Conflicting figures: same beings + same root relation, different numbers.
  const claims = new Map();
  for (const f of feat) {
    for (const n of f.notes) {
      const key = `${String(n.end1).toLowerCase()}|${String(n.label).toLowerCase()}`;
      const nums = (f.pt.text.match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]$/, ""));
      if (!nums.length) continue;
      if (claims.has(key)) {
        const prev = claims.get(key);
        const differ = nums.some((x) => !prev.nums.includes(x));
        if (differ && prev.id !== f.pt.id) {
          // Across tiers the operator's figure stands (hunt.js: fetched
          // material never outranks it) — the fetched statement may leave.
          // Within one tier both stand and the conflict is reported.
          const ta = tierOf.get(prev.id) ?? 0, tb = tierOf.get(f.pt.id) ?? 0;
          const fetched = ta !== tb ? (ta > tb ? prev.id : f.pt.id) : null;
          findings.push({ kind: "conflicting_figures", owner: "Kelsen (reasoning-lint.js)", statements: fetched ? [fetched] : [prev.id, f.pt.id], licenses: fetched ? "prefer-operator" : null, detail: `"${n.end1} ${n.label}" is given ${prev.nums.join(", ")} in ${prev.id} and ${nums.join(", ")} in ${f.pt.id}${fetched ? ` — ${fetched} is fetched material and may leave` : " — both are the operator's; reported, not resolved"}` });
        }
      } else claims.set(key, { nums, id: f.pt.id });
    }
  }
  const allNotes = feat.flatMap((f) => f.notes);
  const cycle = allNotes.length ? findClaimCycle(allNotes) : null;
  if (cycle) findings.push({ kind: "circular_claim", owner: "Kelsen (reasoning-lint.js)", detail: `a chain of claims returns to its start: ${cycle.cycle.join(" → ")}` });

  // ROLE LABELS FROM A REAL, MEASURED/LEARNED VOCABULARY (2026-09-24), never
  // hand-typed here: `roleVocabulary` (when given) is canonical-sections.js's
  // own shape — [{role, order}, …], sourced from huntDeclaredStructure's live
  // corroborated hunt or form-priors.js's fold of one — excluding "title"
  // (thesis already covers that slot). Body groups are already ordered
  // (material order, repaired only on inversion) by the time this runs, so
  // the Nth body group is given the Nth role, POSITION ONLY — this module has
  // no descriptive text per role to match a group's actual content against
  // (a learned prior carries just a role slug like "solution", not a
  // definition), so content-matching is not attempted and not claimed. A
  // group beyond the vocabulary's length, or every group when none was
  // given, keeps the prior "body N" label — a disclosed fallback, not silent.
  const bodyRoles = (roleVocabulary ?? []).filter((r) => r.role !== "title");
  let bodyIdx = 0;
  const bodySlots = groups.map((g) => {
    const base = { statements: g.statements.map((f) => f.pt.id), extent: g.from != null ? [g.from, g.to] : null, beings: g.beings.filter((id) => !R || isProperReferent(R, id)).map((id) => R?.represent(id) ?? id), sources: g.sources };
    if (g === tension) return { slot: "tension", ...base, basis: g.contrast ? "the material marks this group as a turn" : "the material marks this group as a turn: it contradicts the thesis's relation" };
    bodyIdx += 1;
    const role = bodyRoles[bodyIdx - 1];
    const extentBasis = g.from != null ? `, ordered by extent ${g.from}–${g.to}` : ", undated, kept in the material's place";
    // A later group that ALSO contradicts the thesis (Williams, third
    // reading: only the first, chosen as tension, ever carried a local
    // signal) gets its own note, not just the aggregate finding.
    const alsoContradicts = g.statements.some(denies) ? `; contradicts the thesis's relation (see denied_relation)` : "";
    return {
      slot: role ? role.role : `body ${bodyIdx}`,
      ...base,
      basis: (role ? `role "${role.role}" (position ${bodyIdx} of ${bodyRoles.length} in the measured/learned form structure)${extentBasis}` : `grouped by shared beings${extentBasis}`) + alsoContradicts,
    };
  });
  // The null, said plainly (Caro, twice): p has a resolution floor of
  // 1/(draws+1) and the line says when it sits there; the threshold is the
  // null's binding-ENERGY quantile, not an alpha; the basin's count is what
  // cleared, the winner's group's count is what was generalized; every
  // member excluded is named with why; a tie is a tie; and when no basin
  // fires the line says how many candidates carried a note and what the
  // kernel found.
  const nullLine = (b) => { const n = b.cohesionNull; const draws = n.protocol.iterations; const atFloor = n.pValue * (draws + 1) <= 1 + 1e-9; return `p=${n.pValue.toFixed(3)}${atFloor ? ` — at the floor 1/${draws + 1}: no draw of ${draws} reached the observed energy` : ` (floor 1/${draws + 1} at ${draws} permutations)`}; binding energy ${n.observed.toFixed(3)} above the null's ${Math.round(n.quantile * 100)}th quantile ${n.threshold.toFixed(3)}, over relation+polarity+via features`; };
  const tied = candidates.filter((c) => c.score === candidates[0]?.score).length;
  const tieLine = tied > 1 ? `, tied with ${tied - 1} other(s); first by position` : "";
  const excludedLine = (s) => ((s?.excluded ?? []).length ? `; excluded from the winner's group: ${s.excluded.map((e) => `${e.statements.join(", ")} (${e.relation}, ${e.polarity}, ${e.via})`).join("; ")}` : "");
  const unresolvedLine = (s) => ((s?.unresolved ?? []).length ? `; ${s.unresolved.length} note(s) left unresolved by a negation the read did not place: ${s.unresolved.join(", ")}` : "");
  const absentLine = gen && Object.keys(gen.generalization.absent).length ? `; absent on some claims: ${Object.entries(gen.generalization.absent).map(([k, n]) => `${k} (${n})`).join(", ")}` : "";
  const guardLine = guardExcluded.length
    ? `; the one-subject guard excluded ${guardExcluded.length} member(s) naming a different being from the winner: ${guardExcluded.map((g) => `${g.id} (${g.beings})`).join(", ")}`
    : basin && !R ? "; the one-subject guard did not run (no resolver on the draft)" : "";
  const beheadedLine = beheadedParts.size ? `; ${beheadedParts.size} source paragraph(s) lost a sentence to the thesis part (${openingLost} of them their opening sentence)` : "";
  const thesisBasis = !thesis ? "no general statement in the material — the thesis is a gap"
    : `the general statement whose words recur across the most parts (recurrence ${candidates[0].score.toFixed(2)}${tieLine})${
      gen ? `; a basin of ${basin.memberCount} cleared its null (${nullLine(basin)}); ${gen.statements.length} of them share the winner's relation "${gen.relation}" (${gen.polarity}, ${gen.via}) and were generalized: ${Object.keys(gen.generalization.agreed).join(", ") || "nothing"} agreed, ${Object.keys(gen.generalization.varying).join(", ") || "nothing"} varying${absentLine}${excludedLine(synth)}${unresolvedLine(synth)}${guardLine} — the generalized claim stands beside the winner's sentence; its members are held out of the body groups${beheadedLine}`
        : basin ? `; a basin of ${basin.memberCount} cleared its null (${nullLine(basin)}) but nothing was generalized: ${synth.refused}${excludedLine(synth)}${unresolvedLine(synth)}${guardLine}`
          : hunt?.elsewhere?.length ? `; a basin of ${hunt.elsewhere[0].memberCount} cleared its null (${nullLine(hunt.elsewhere[0])}) but does not hold the winner ${thesis.pt.id}${thesis.notes[0] ? ` (its note: ${thesis.notes[0].label}, ${thesis.notes[0].polarity}, ${thesis.notes[0].via})` : " (it carries no relation note)"}: ${hunt.elsewhere[0].memberRefs.join(", ")} — the thesis is the winner alone`
            : hunt ? `; no basin: ${hunt.noted} of ${pool.length} candidates carry a relation note; the kernel found ${hunt.diagnostics.basins} basin(s), ${hunt.diagnostics.validated} validated, over ${hunt.diagnostics.entities} noted candidate(s) (prevalence floor 1/√n)`
              : ""}`;
  const slots = [
    {
      slot: "thesis", statements: [...thesisMemberIds], winner: thesis?.pt.id ?? null, claim: gen?.generalization ?? null, rendered: gen ? renderGeneralization(gen.generalization, "SVO") : null,
      basis: thesisBasis,
    },
    ...bodySlots,
    { slot: "return", statements: [], basis: thesisMemberIds.size ? `the close comes back to the thesis (${[...thesisMemberIds].join(", ")})` : "no thesis to return to" },
  ];
  for (const d of duplicates) findings.push({ kind: "duplicate_across_sources", owner: "Tracy Kidder & Richard Todd", detail: `${d.drop} states what ${d.keep} states (${[...d.sharedFigures, ...d.sharedNames].slice(0, 4).join(", ")}): said once, from ${d.keep}${d.tiered ? " — the operator's material, though the fetched statement was richer" : ""}` });
  if (!tension) findings.push({ kind: "no_tension", owner: "the void (arrangement)", detail: "the material marks no turn, so the tension slot is a declared gap rather than an invented counterpoint" });

  const allClaims = claimsFromFeat(feat);
  // LOAD-BEARING THESIS SIGNAL (2026-09-26): additive, opt-in only via a
  // caller-declared `pValue` (never defaulted -- consequentialSurprise's own
  // guard requires one, and this project's standing rule forbids a hand-set
  // threshold). Found and verified this revision on REAL, unaltered content
  // (a public-domain folk tale, not built to force this): the existing
  // recur()-based candidate/winner selection can genuinely MISS a candidate
  // that is mechanically, verifiably repeated -- three identical wolf/knock/
  // door claims scored 0.57 while a different, non-repeated sentence scored
  // 0.61 and won. Tested directly against the real repeated claims,
  // independent of thesis selection: 0.25 load-bearing rate vs 0.071 for the
  // rest of the document (kernel/consequential-surprise.js, the-fold/claim-
  // dependencies.js's own real dependency relation). This does NOT change
  // which candidate wins -- it only adds a real, computed `loadBearing` flag
  // callers can use alongside the existing recur score, since the two
  // signals measure different things and neither one alone is complete.
  // Delegates to the-fold/claim-dependencies.js's loadBearingChecker, which
  // consolidates this exact clone-holo/build-index/run-consequentialSurprise
  // pattern (previously hand-rolled separately here, in cli/fold-at.mjs, and
  // in this session's own test scripts) into one shared, tested utility.
  const loadBearingOf = loadBearingChecker(allClaims.claims, { pValue });
  // EXTENDS THE SAME SIGNAL TO EVERY BODY GROUP (2026-09-26), not just the
  // four thesisCandidates: mutates bodySlots in place, safe because `slots`
  // above already holds these exact object references (spread via
  // `...bodySlots`), so this reaches the returned outline without
  // restructuring the construction order. Combined honestly across each
  // group's own statements: true if ANY is load-bearing, null only when
  // EVERY one is null (nothing checkable, including an empty group, where
  // Array.prototype.every on [] is true by definition), false otherwise --
  // never a guessed false.
  for (const s of bodySlots) {
    const per = s.statements.map((id) => loadBearingOf(id));
    s.loadBearing = per.some((x) => x === true) ? true : per.every((x) => x === null) ? null : false;
  }

  return {
    schema: OUTLINE_SCHEMA,
    // `id` is ALWAYS today's single winner (hunt-falsify.test.mjs reads it)
    // and `text` is ALWAYS its own sentence — pipeline-run.mjs hands `text`
    // to the mouth as the piece's claim, and a lemma-join is not a sentence
    // (the reading archons, 2026-09-25). `ids`, `claim` and `rendered` are
    // additive. `loadBearing` is additive too (2026-09-26): null unless the
    // caller declares `pValue`.
    thesis: thesis ? { id: thesis.pt.id, ids: [...thesisMemberIds], text: thesis.pt.text, claim: gen?.generalization ?? null, rendered: gen ? renderGeneralization(gen.generalization, "SVO") : null, loadBearing: loadBearingOf(thesis.pt.id) } : null,
    thesisCandidates: candidates.slice(0, 4).map((c) => ({ id: c.f.pt.id, score: Number(c.score.toFixed(2)), text: c.f.pt.text, loadBearing: loadBearingOf(c.f.pt.id) })),
    // ADDITIVE (2026-09-26): claimsFromFeat(feat) run over every point in
    // this material, not just the rare thesis-generalization winners above --
    // real, holon-addressed GFP claims (the-fold/fold-at.js's own cursor
    // addressing), exposed here so a real caller can reach them without
    // reaching into arrangeEssay's own function-local `feat`. See this
    // file's claimsFromFeat for what it does and does not attempt.
    claims: allClaims,
    slots, links, findings, weakened,
    basis: `${groups.length} body group(s) from ${parts.length} source part(s); ${links.filter((l) => l.kind === "succession").length} succession, ${links.filter((l) => l.kind === "overlap").length} overlap, ${links.filter((l) => l.kind === "inversion").length} inversion link(s); ${findings.length} reasoning finding(s)`,
  };
}

/** The outline as readable lines. */
export function outlineLines(outline, draft) {
  const text = new Map(drawnParts(draft).flatMap((p) => p.children.map((pt) => [pt.id, pt.text])));
  const out = [];
  for (const s of outline.slots) {
    out.push(`${s.slot.toUpperCase()}${s.extent ? `  [${s.extent[0]}–${s.extent[1]}]` : ""}${s.beings?.length ? `  beings: ${s.beings.slice(0, 5).join(", ")}` : ""}   ← ${s.basis}`);
    for (const id of s.statements) out.push(`    ${id}  ${text.get(id) ?? ""}`);
  }
  if (outline.links.length) out.push(`LINKS  ${outline.links.map((l) => `${l.from + 1}→${l.to + 1} ${l.kind}`).join(" · ")}`);
  for (const f of outline.findings) out.push(`FINDING [${f.kind}] ${f.owner}: ${f.detail}`);
  for (const w of outline.weakened) out.push(`WEAKENED: ${w}`);
  return out;
}

/**
 * arrangedDraft(draft, outline) → a draft whose parts ARE the outline: the
 * thesis opens the piece as its own part, then each body group (its
 * statements in the material's order, their ids and byte spans unchanged),
 * in the outline's order. A thesis part that carries a generalized claim
 * holds every witness, in the material's order; its span is the WINNER's
 * (the slot's `winner`), and the claim and its rendering ride beside its
 * text, never as it. Every later stage — floor, prose, fold, turns — reads
 * this draft, so the piece follows the composed shape, not the source's
 * paragraphing. The original draft is not touched (append-only: the ledger
 * keeps both). The return slot has no statement: the close is written by
 * the arrival stage and read against the thesis there.
 */
export function arrangedDraft(draft, outline) {
  if (!draft?.root || !outline?.slots) return draft;
  const byId = new Map(drawnParts(draft).flatMap((p) => p.children.map((pt) => [pt.id, pt])));
  const pervasive = new Set(draft.pervasive ?? []);
  const parts = [];
  for (const s of outline.slots) {
    const pts = s.statements.map((id) => byId.get(id)).filter(Boolean);
    if (!pts.length) continue;
    const id = s.slot === "thesis" ? "a0" : `a${parts.length}`;
    parts.push({
      id, path: `whole/${id}`, depth: 1, kind: "part", slot: s.slot, relevant: true, ...(s.answers ? { answers: s.answers } : {}),
      text: pts.map((pt) => pt.text).join(" "),
      // A generalized claim travels beside the part, never as its text: the
      // text stays the statements' own sentences, byte-true to `spans`.
      ...(s.claim ? { claim: s.claim, rendered: s.rendered ?? null } : {}),
      span: { ...((s.winner && byId.get(s.winner)) ? byId.get(s.winner).span : pts[0].span) }, spans: pts.map((pt) => ({ ...pt.span })),
      children: pts, from: [...new Set(pts.map((pt) => pt.path.split("/")[1]))],
      names: [...new Set(pts.flatMap((pt) => pt.names ?? []))],
      words: [...new Set(pts.flatMap((pt) => pt.words ?? []))],
    });
  }
  let prev = null;
  for (const p of parts) {
    if (prev) {
      const shared = p.names.filter((n) => prev.names.includes(n) && !pervasive.has(n));
      p.bridge = shared.length ? { from: prev.id, name: shared[0] } : { from: prev.id, name: null };
    } else p.bridge = null;
    prev = p;
  }
  const root = { ...draft.root, children: parts };
  const claimed = outline.slots.find((s) => s.slot === "thesis" && s.claim) ?? null;
  const partOf = new Map(drawnParts(draft).flatMap((p) => (p.children ?? []).map((c) => [c.id, p])));
  const beheadedParts = claimed ? new Set(claimed.statements.map((id) => partOf.get(id)).filter((p) => p && (p.children ?? []).length > 1).map((p) => p.id)) : new Set();
  const openingLost = claimed ? claimed.statements.filter((id) => { const p = partOf.get(id); return p && (p.children ?? []).length > 1 && p.children[0]?.id === id; }).length : 0;
  return {
    ...draft, root, arrangedFrom: outline.schema,
    basis: `${parts.length} part(s) composed by the outline (${outline.basis}); ${parts.filter((p) => p.bridge && !p.bridge.name).length} transition(s) have no shared name and must be written${claimed ? `; 1 part carries a claim generalized from ${claimed.statements.length} statements (part.claim; part.rendered is its mechanical surface, handed to no mouth) — its text is those statements' own sentences in the material's order, its span the winner's${beheadedParts.size ? `; ${beheadedParts.size} source paragraph(s) lost a sentence to it (${openingLost} of them their opening sentence)` : ""}` : ""}`,
  };
}

/**
 * selectToBudget({ outline, draft, task }) → { outline, dropped, budget }.
 * SELECTION, MECHANICAL BASE: when the ask states a length ("a five-paragraph
 * essay", "600 words"), the body sections closest to the ask fill it, kept in
 * outline order; the rest leave the piece, each on the record. Closeness is
 * the being the ask names and the words of its topic phrase that a section
 * carries. With no stated length nothing is cut on size — the void's extent
 * is then the material's own, and only relevance (the mouth's "neither",
 * licensed by the mechanics) removes sections.
 * A paragraph budget of n spends one paragraph on the thesis and one on the
 * close, the form's own shape, and the rest on body sections.
 */
export const DECLARED_FORM = Object.freeze({ paragraphs: 5, basis: "declared: the essay's received form — a thesis paragraph, three body sections, a close; any length the ask states overrides it" });
export function selectToBudget({ outline, draft, task = "", shape = null, wordsPerPage = null } = {}) {
  // SELECT HARD (user, 2026-09-21: "don't write everything in the dossier").
  // The ask's stated length first; else the shape LEARNED from the sources
  // (shape.js, stage 4 — "we dont want a set of shapes pre-set"); only then
  // the received default, disclosed as a default.
  const learned = (shape?.agreedUnits ?? []).find((a) => ["paragraph", "section", "part", "word", "sentence"].includes(a.unit));
  const asked = askedExtentOf(task)
    ?? (learned ? { n: learned.n, unit: learned.unit, learned: `${learned.support}/${shape.hosts} host(s)` } : null)
    ?? { n: DECLARED_FORM.paragraphs, unit: "paragraph", declared: true };
  if (!outline?.slots) return { outline, dropped: [], budget: null };
  const text = new Map(drawnParts(draft).flatMap((p) => p.children.map((pt) => [pt.id, pt.text])));
  const bodies = outline.slots.filter((s) => s.slot !== "thesis" && s.slot !== "return");
  const words = (s) => s.statements.map((id) => text.get(id) ?? "").join(" ").split(/\s+/).filter(Boolean).length;
  let budget = null;
  if (["paragraph", "section", "part"].includes(asked.unit)) budget = { sections: Math.max(1, asked.n - 2) };
  else if (asked.unit === "word") budget = { words: asked.n };
  else if (asked.unit === "sentence") budget = { statements: asked.n };
  // PAGE IS NEVER A HAND-SET RATIO (2026-09-26, direct user correction, twice
  // over: first that a hard-coded 275 words/page was exactly the kind of
  // "table [that] says a sonnet has fourteen lines" shape.js's own header
  // already refuses, then that a bespoke words-per-page-only learning
  // function was itself too specialized). `wordsPerPage` is always the
  // CALLER's own injected result of parameter-induction.js's general
  // induceParameter("words-per-page", …) — memory-first, then real
  // multi-host-corroborated search, never anything this function invents.
  // No value supplied → no page budget applied, disclosed honestly (below).
  else if (asked.unit === "page" && wordsPerPage?.value) budget = { words: asked.n * wordsPerPage.value };
  if (!budget) return { outline, dropped: [], budget: null };
  const R = draft?.referents ?? null;
  const askBeings = R ? R.resolveText(task) : new Set();
  const topic = new Set(draftWords(String(task).match(/\b(?:on|about|of)\s+(.+?)[.?!]*$/i)?.[1] ?? "").filter((w) => !isFunctionWord(w)));
  const close = (s) => {
    const t = s.statements.map((id) => text.get(id) ?? "").join(" ");
    const b = R ? [...R.resolveText(t)].filter((id) => askBeings.has(id)).length : 0;
    return b + draftWords(t).filter((w) => topic.has(w)).length / Math.max(1, s.statements.length);
  };
  const ranked0 = bodies.map((s, i) => ({ s, i, c: close(s) })).sort((a, b) => b.c - a.c || a.i - b.i);
  // Every question the ask coordinates gets its closest section first (the
  // mouth's steered `answers`), then the rest fill by closeness.
  const qs = [...new Set(bodies.map((s) => s.answers).filter(Boolean))];
  const firsts = qs.map((q) => ranked0.find((r) => r.s.answers === q)).filter(Boolean);
  const ranked = [...firsts, ...ranked0.filter((r) => !firsts.includes(r))];
  const keep = new Set();
  let used = 0;
  for (const r of ranked) {
    const cost = budget.sections ? 1 : budget.words ? words(r.s) : r.s.statements.length;
    const cap = budget.sections ?? budget.words ?? budget.statements;
    if (used + cost > cap && keep.size) continue;
    keep.add(r.s); used += cost;
  }
  const dropped = bodies.filter((s) => !keep.has(s));
  const slots = outline.slots.filter((s) => !dropped.includes(s));
  const whose = asked.declared ? "the declared form's" : asked.learned ? `the learned shape's (${asked.learned})` : "the asked";
  return {
    outline: { ...outline, slots, basis: `${outline.basis}; ${dropped.length} section(s) left out to fit ${whose} ${asked.n} ${asked.unit}(s)` },
    dropped: dropped.map((s) => ({ slot: s.slot, statements: s.statements, why: `over ${whose} length (${asked.n} ${asked.unit}s); closer sections kept` })),
    budget: { ...budget, basis: asked.declared ? DECLARED_FORM.basis : asked.learned ? `measured: the shape learned from ${asked.learned} (shape.js)` : asked.unit === "page" && wordsPerPage?.basis ? `asked (${asked.n} page(s)); ${wordsPerPage.basis}` : "asked" },
  };
}
