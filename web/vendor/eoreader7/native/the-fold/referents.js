// referents.js — THE PIPELINE ASKS WHO, NOT WHICH STRING (2026-09-21).
//
// The user's standing correction, restated for this pipeline: "all of our
// assertions of what a word is — it's just that assertion, it's pointing to a
// referent; that is how we are able to deal with typos." Every check the
// generation pipeline grew — a fact's anchors, whether prose carried it, what
// the subject is, whether a part takes up the last one — matched STRINGS. A
// sentence that says "Donelson" for "John Donelson", or "Walker" for "Dr.
// Thomas Walker", is making the same assertion about the same being, and a
// string test cannot see that.
//
// This module builds ONE resolver over the material with the engine's own
// referent organ (organs/cast.js `makeReferentIndex`, via namesCorefer and
// diaNorm) and answers every such question in referent ids. It adds nothing
// to the organ's notion of identity except one thing the organ itself should
// own and does not yet: a possessive ("Donelson's") is inflection of a name,
// not a new name, so it is resolved as its base.
//
// WHAT THE ORGAN DOES NOT YET DO, MEASURED 2026-09-21 on the Cumberland
// ground, and so what this pipeline cannot yet do:
//   - a misspelling ("Donelsn", "Cumberlnd", "Nashvile") resolves to nothing;
//   - identity fragments: "Cumberland", "Cumberland River" and "The Cumberland
//     River" are three referents; sentence openers ("Today", "May", "Old")
//     became referents of their own.
// Those belong in the referent organ, not here. Until they are fixed there, a
// misspelled name in the prose simply fails to carry its fact, and the fact is
// redrawn or floored — conservative, never a wrong binding.

import { makeReferentIndex } from "../organs/cast.js";
import { splitSentences } from "../adapters/text/spans.js";
import { extractSurfaces, discoverReferents, namesCorefer, diaNorm, extractLeadingSurfaces } from "../adapters/text/surfaces.js";
import { directDescriptorOccurrences } from "../adapters/text/individuation.js";
import { nameRuns } from "./referent-verify.js";
import { dominantClass, isFunctionWord } from "./pos-prior.js";

const stripPossessive = (s) => String(s).replace(/['’]s\b/g, "").replace(/s['’](?=\s|$)/g, "s");

const descSlug = (s) => String(s ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");

/**
 * descriptorReferents(text) → [{ id, surface, bare, head }] — the
 * common-nominal tier capitalisation cannot see. One entry per recurrent
 * definite/possessive descriptor ("the pawl", "the wheel"): the SAME
 * closed-determiner rule individuation.js states
 * (directDescriptorOccurrences — lowercased, no capitals anywhere),
 * promoted to a provisional referent only on recurrence across distinct
 * sentences (never a singleton) and only when the head is not a settled
 * function word (the asymmetric polarity: the prior refuses where it has
 * coverage, stays silent where it has none — an unseen head like "pawl"
 * is admitted, "the same" never recurs and "theirs" never emits).
 * Returns [] on grounds that earn none.
 */
export function descriptorReferents(text) {
  const src = String(text ?? "");
  if (!src.trim()) return [];
  let sents;
  try { sents = splitSentences(src); } catch { return []; }
  const groups = new Map();
  sents.forEach((s, i) => {
    let occs;
    try { occs = directDescriptorOccurrences(s?.text ?? "", { encounterRef: `sent:${s?.order ?? i}` }); } catch { return; }
    for (const o of occs ?? []) {
      const canon = String(o?.canonicalSurface ?? "").trim();
      if (!canon) continue;
      let g = groups.get(canon);
      if (!g) { g = { canonical: canon, determinations: new Set(), sents: new Set() }; groups.set(canon, g); }
      if (o.determination) g.determinations.add(o.determination);
      g.sents.add(s?.order ?? i);
    }
  });
  const out = [];
  for (const g of groups.values()) {
    if (g.sents.size < 2) continue;
    if (!g.determinations.has("definite") && !g.determinations.has("possessive")) continue;
    const bare = g.canonical.replace(/^(the|a|an|my|your|his|her|our|their)\s+/i, "").trim();
    const head = bare.split(/\s+/).pop() ?? "";
    if (head.length < 3) continue;
    if (isFunctionWord(head)) continue;
    out.push({ id: `ref:descriptor:${descSlug(g.canonical)}`, surface: g.canonical, bare, head });
  }
  return out.sort((a, b) => a.id < b.id ? -1 : 1);
}

/**
 * buildReferents(ground) → { resolveText, resolveName, represent, size }
 *   resolveName(name)  → Set of referent ids the name points at
 *   resolveText(text)  → Set of referent ids any name in the text points at
 *   represent(id)      → the referent's most-individuated surface
 */
export function buildReferents(ground) {
  const indexFor = makeReferentIndex({ splitSentences, extractSurfaces, discoverReferents, namesCorefer, diaNorm, leadingSurfaces: extractLeadingSurfaces });
  const idx = indexFor([{ text: String(ground ?? "") }]);
  // THE DESCRIPTOR TIER (2026-09-30, Freewheel mechanism ground). The organ
  // above admits by capitalisation and by nothing else: on lowercase
  // mechanism prose it found nothing (or a sentence-initial singleton like
  // "Rotating"), while individuation.js's determiner rule — lowercased,
  // no capitals — held live hypotheses for the pawl, the cassette, the
  // cyclist, the wheel and the teeth. Capitalisation keeps its narrow,
  // contextual job (proper names in cased scripts); recurrent definite /
  // possessive descriptors do the common-nominal job here, by the same
  // rule individuation.js already states: a closed-class determiner plus a
  // witnessed lexical form, recurring across distinct sentences. Same
  // recurrence bar the name tier earns by (distinct sentences, not raw
  // mentions), the same article-stripped norm this file already folds
  // with, and the same conservative polarity the POS gate holds elsewhere:
  // a head the prior SETTLES as a function word is refused; a head it has
  // never seen is admitted — the determiner plus the recurrence is the
  // evidence, never the prior's silence. Omitted from every map when the
  // ground earns none, so grounds without descriptors read byte-identical
  // to before this tier existed.
  const descriptors = descriptorReferents(String(ground ?? ""));
  // ONE BEING, ONE ID, FOR THE TWO CASES THAT ARE NOT NAMING AT ALL. The organ
  // made "The Cumberland River" and "Cumberland River" two referents, and
  // "Nashville's" a referent beside "Nashville". A leading article and a
  // possessive are grammar around a name, never part of it, so referents whose
  // surfaces differ ONLY by those are folded to one canonical id. Nothing else
  // is merged here: "Lake Cumberland" and "Cumberland Park" stay distinct,
  // which is the organ's call, not this module's.
  const norm = (s) => stripPossessive(String(s ?? "")).toLowerCase().replace(/^(the|a|an)(\s+|$)/, "").replace(/\s+/g, " ").trim();
  const canon = new Map();
  const byNorm = new Map();
  for (const id of [...idx.referents].sort()) {
    const n = norm(idx.represent(id));
    if (!byNorm.has(n)) byNorm.set(n, id);
    canon.set(id, byNorm.get(n));
  }
  const cache = new Map();
  // Filled by the descriptor admission below (after theHeadNoun is known,
  // so a descriptor the name tier already claims never mints a second id).
  // Maps (mutated once at admission, read per call) so resolveName needs
  // no reorder — including the counts tally below, which resolves before
  // admission has filled them (empty maps then, never TDZ).
  const descByNorm = new Map();
  const descById = new Map();
  const resolveName = (name) => {
    const key = String(name ?? "").trim();
    if (!key) return new Set();
    if (cache.has(key)) return cache.get(key);
    let ids = idx.resolve(key);
    if (!ids.size) ids = idx.resolve(stripPossessive(key));
    // A NAME THE PRIOR SETTLES AS NON-NOMINAL IS NEVER ASSERTED (2026-09-30).
    // The organ admits sentence-initial singletons on position plus
    // lowercase absence, which on a small window lets "When", "May", "Old"
    // through as referents of their own (this file's own header names
    // that class). The oneWord map below already refuses them its
    // lowercase assertion (noun, proper noun, or unseen only); resolveName
    // now holds the SAME bar — never a new rule, the same contextual rule
    // on both paths, so exact-case and lowercase queries agree. ONLY where
    // the prior settles (the asymmetric polarity: an unseen word like
    // "Napoleon" or "Rotating" still resolves; the prior's silence is
    // never evidence). Descriptor ids are exempt: their heads passed this
    // bar at admission.
    if (ids.size) {
      const kept = [...ids].filter((id) => {
        if (descById.has(id)) return true;
        const n = norm(idx.represent(id) ?? "");
        if (n.includes(" ")) return true;
        const cls = dominantClass(n);
        return cls === null || cls === "NOUN" || cls === "PROPN";
      });
      ids = new Set(kept);
    }
    if (!ids.size) {
      const did = descByNorm.get(norm(key)) ?? descByNorm.get(norm(stripPossessive(key)));
      if (did) ids = new Set([did]);
    }
    // WHEN A NAME REACHES SEVERAL BEINGS, THE ONE IT NAMES EXACTLY WINS.
    // "Cumberland" reached Cumberland, Cumberland River, Cumberland Park and
    // Lake Cumberland at once, and arrangement then chained unrelated parts
    // through Cumberland Park (measured 2026-09-21). If one referent's surface
    // is exactly the name, the name points at that one.
    if (ids.size > 1) {
      const want = norm(key);
      const exact = [...ids].filter((id) => norm(idx.represent(id)) === want);
      if (exact.length) ids = new Set(exact);
    }
    const out = new Set([...ids].map((id) => canon.get(id) ?? id));
    cache.set(key, out);
    return out;
  };
  // A ONE-WORD REFERENT IS ASSERTED IN ANY CASE. On small material the organ
  // admits a common noun that only ever opens a sentence ("Warehouses lined
  // the waterfront") as a referent; prose then says "warehouses" and a
  // capitals-only scan cannot see it is the same assertion. So a lowercase
  // word matching a one-word referent — singular or plural — resolves to it.
  const sing = (w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const oneWord = new Map();
  for (const id of idx.referents) {
    const n = norm(idx.represent(id));
    // Only a word the prior reads as a thing (noun, proper noun, or unseen)
    // is asserted in lowercase. A one-word "referent" that is really a modal,
    // an adjective or an adverb the organ admitted from a sentence opening
    // ("May", "Old") would otherwise capture every lowercase "may" and "old".
    const cls = n && !n.includes(" ") ? dominantClass(n) : null;
    if (n && !n.includes(" ") && (cls === null || cls === "NOUN" || cls === "PROPN")) oneWord.set(sing(n), canon.get(id) ?? id);
  }
  // "THE <HEAD NOUN>": a definite, generic reference to a MULTI-word name's
  // own last word ("the river" for "Cumberland River") — the same insight
  // arrange.js's anchorEchoed already uses for Clark's restatement check,
  // extended here to this module's own, more fundamental resolution, which
  // every carries()/coverage() check in the pipeline depends on (measured
  // live 2026-09-26: a real, faithful mouth sentence — "...locks and dams
  // along the river..." — failed to carry its own statement's Cumberland
  // River anchor for exactly this reason). Measured, never hand-set: this
  // file's own real fixture (cumberland-ground.md) names THREE referents
  // ending in "river" (Cumberland River, Ohio River, Shawnee River), so
  // "the river" resolves only to whichever one is a real, COUNTED MAJORITY
  // of that tail word's own mentions in THIS ground — never picked by any
  // rule beyond that count. A genuine tie, or no clear majority, resolves
  // nothing: "conservative, never a wrong binding" (this file's own rule).
  const tailGroups = new Map();
  for (const id of idx.referents) {
    const n = norm(idx.represent(id));
    if (!n.includes(" ")) continue;
    const words = n.split(" ");
    const tail = sing(words[words.length - 1]);
    // Only a real naming tail (river, museum…) — never a name's own second
    // proper word. Matches oneWord's own adjacent convention exactly (a word
    // like "river" is classed PROPN as often as NOUN, since it usually
    // appears inside a capitalized multi-word name — measured directly this
    // turn: dominantClass("river") === "PROPN").
    const cls = dominantClass(tail);
    if (cls !== null && cls !== "NOUN" && cls !== "PROPN") continue;
    const canonId = canon.get(id) ?? id;
    if (!tailGroups.has(tail)) tailGroups.set(tail, []);
    tailGroups.get(tail).push(canonId);
  }
  // Count each canonical referent's real occurrences across the WHOLE
  // ground, once — the identical name-run/resolveName matching resolveText
  // already does per call below, tallied here instead of deduped into a set.
  const counts = new Map();
  for (const run of nameRuns(stripPossessive(String(ground ?? "")))) {
    for (let i = 0; i < run.length; i++) {
      if (!norm(run.slice(i).join(" "))) continue;
      const ids = resolveName(run.slice(i).join(" "));
      if (ids.size) { for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1); break; }
    }
  }
  const theHeadNoun = new Map();
  for (const [tail, ids] of tailGroups) {
    const unique = [...new Set(ids)];
    if (unique.length === 1) { theHeadNoun.set(tail, unique[0]); continue; }
    const scored = unique.map((id) => ({ id, n: counts.get(id) ?? 0 })).sort((a, b) => b.n - a.n);
    const total = scored.reduce((s, x) => s + x.n, 0);
    if (scored[0].n > 0 && scored[0].n * 2 > total) theHeadNoun.set(tail, scored[0].id);
  }
  // DESCRIPTOR ADMISSION — one being, one id, the name tier wins. A
  // descriptor whose bare head the name tier already asserts ("warehouses",
  // a one-word name referent) aliases to that referent instead of minting
  // a second id; one whose head ends ANY multi-word name ("the river"
  // beside Cumberland River) is left to the name tier and its "the <head
  // noun>" rule alone — never a competing generic id that would join
  // parts the name tier kept apart. What remains mints ref:descriptor:
  // ids — the Freewheel tier (the pawl, the cassette, the cyclist, the
  // wheel, the teeth), each resolvable in any case, each represented by
  // its canonical descriptor.
  const nameTails = new Set();
  for (const id of idx.referents) {
    const words = norm(idx.represent(id)).split(" ").filter(Boolean);
    if (words.length > 1) nameTails.add(sing(words[words.length - 1]));
  }
  for (const d of descriptors) {
    const key = norm(d.surface);
    if (!key) continue;
    // Possessive-folded before any comparison: "the river's" is "river"
    // the same way oneWord's and nameTails' own keys are (their norms
    // strip the clitic) — otherwise the clitic spells a second being.
    const headKey = sing(norm(d.bare));
    const named = oneWord.get(headKey);
    if (named) { descByNorm.set(key, named); continue; }
    if (nameTails.has(headKey)) continue;
    if (descByNorm.has(key)) continue;
    descByNorm.set(key, d.id);
    descById.set(d.id, d);
    if (!oneWord.has(headKey)) oneWord.set(headKey, d.id);
  }
  const resolveText = (text) => {
    const out = new Set();
    const stripped = stripPossessive(String(text ?? ""));
    const lower = stripped.toLowerCase();
    for (const tok of lower.split(/[^\p{L}\p{N}]+/u)) {
      const id = tok ? oneWord.get(sing(tok)) : null;
      if (id) out.add(id);
    }
    // Matched against the ORIGINAL casing, never the lowercased copy: a
    // genuinely generic reference ("the river") is always naturally
    // lowercase in real prose; a capitalized word here is a proper name's
    // own first word ("the Cumberland" inside "the Cumberland River"), never
    // this pattern's business — measured live this turn: lowercasing first
    // made "the Cumberland River" spuriously match "the Cumberland" and
    // resolve an unrelated single-candidate tail (Lake Cumberland).
    for (const m of stripped.matchAll(/\bthe\s+([a-z]+)\b/g)) {
      const id = theHeadNoun.get(sing(m[1]));
      if (id) out.add(id);
    }
    // Descriptor occurrences, by the SAME determiner rule that admitted
    // them — a lowercase ask ("how does the pawl catch") resolves through
    // its own occurrences, never through a capital scan. The oneWord loop
    // above already catches bare heads ("pawl"); this catches the full
    // canonical form and any head the tokenizer split differently.
    if (descById.size) {
      let occs;
      try { occs = directDescriptorOccurrences(stripped); } catch { occs = null; }
      for (const o of occs ?? []) {
        const id = o?.canonicalSurface && descByNorm.get(norm(o.canonicalSurface));
        if (id) out.add(id);
      }
    }
    for (const run of nameRuns(stripPossessive(text))) {
      // Try the whole run, then each tail of it, so "Before Dr. Thomas Walker"
      // or "While the Cumberland River" still reach the name inside.
      for (let i = 0; i < run.length; i++) {
        // A tail that is only an article names nothing: a sentence opening on
        // a bare "The" resolved to "The USGS" and made it a subject referent.
        if (!norm(run.slice(i).join(" "))) continue;
        const ids = resolveName(run.slice(i).join(" "));
        if (ids.size) { for (const id of ids) out.add(id); break; }
      }
    }
    return out;
  };
  const represent = (id) => descById.has(id) ? descById.get(id).surface : idx.represent(id);
  return { resolveName, resolveText, represent, size: idx.referents.size + descById.size, descriptors: descById.size, index: idx };
}

/**
 * attachReferents(draft, R) → the draft, now carrying its resolver and its
 * SUBJECT REFERENTS: beings named in more of the drawn parts than not. The
 * subject is what the whole is about; it is never demanded of a single fact
 * and never counts as one part taking up another. Measured, not listed.
 */
export function attachReferents(draft, R) {
  if (!draft?.root || !R) return draft;
  const parts = (draft.root.children ?? []).filter((p) => p.relevant !== false);
  const df = new Map();
  for (const p of parts) for (const id of R.resolveText(p.text ?? "")) df.set(id, (df.get(id) ?? 0) + 1);
  draft.referents = R;
  draft.subjectRefs = new Set([...df.entries()].filter(([, d]) => d * 2 > parts.length).map(([id]) => id));
  // RELEVANCE, BY WHO AND BY HOPS. The draft's own relevance pass tests the
  // ask's literal words; "Franck" never matched "Dr. Louis Franck" and an
  // EPA paragraph never said "mining" (falsifier: 2 of 9 and 5 of 26 parts
  // drawn). Here a part is also drawn when it names a being the ask names, or
  // shares a proper being with a part already drawn — expanding hop by hop
  // until nothing new joins (the hop bound is where the material stops
  // connecting, not a chosen depth).
  const all = draft.root.children ?? [];
  const asked = R.resolveText(draft.task ?? "");
  const beingsOf = new Map(all.map((p) => [p.id, new Set([...R.resolveText(p.text ?? "")].filter((id) => isProperReferent(R, id)))]));
  let changed = false;
  for (const p of all) if (!p.relevant && [...beingsOf.get(p.id)].some((id) => asked.has(id))) { p.relevant = true; p.drawnBy = "names a being the ask names"; changed = true; }
  if (all.some((p) => p.relevant) && all.some((p) => !p.relevant)) {
    for (let grew = true; grew;) {
      grew = false;
      const held = new Set(all.filter((p) => p.relevant).flatMap((p) => [...beingsOf.get(p.id)]));
      for (const p of all) if (!p.relevant && [...beingsOf.get(p.id)].some((id) => held.has(id) && !draft.subjectRefs.has(id))) { p.relevant = true; p.drawnBy = "shares a being with a drawn part"; grew = changed = true; }
    }
  }
  if (changed) draft.basis = `${draft.basis}; ${all.filter((p) => p.drawnBy).length} more part(s) drawn by referent (the ask's beings, then shared beings hop by hop)`;
  return draft;
}

/** Is this referent a PROPER being (a multi-word name, or one word the prior
 *  does not read as a common noun)? Common-noun referents the organ admitted
 *  from sentence openings ("Warehouses", "Steamboats") are real things of the
 *  material but too general to join parts across sources. Descriptor-tier
 *  referents (ref:descriptor: — admitted by determiner + recurrence, never
 *  by naming) are that class BY CONSTRUCTION: the determiner itself marks
 *  the head common, stronger evidence than the prior's silence about it —
 *  so they never count as proper even when the prior has never seen the
 *  head ("pawl"). They still resolve asks and name ask-drawn parts; they
 *  just never join parts across sources through the guard/hop arithmetic.
 */
export function isProperReferent(R, id) {
  if (String(id ?? "").startsWith("ref:descriptor:")) return false;
  const surface = String(R.represent(id) ?? "").replace(/^(the|a|an)\s+/i, "");
  if (!surface) return false;
  if (surface.includes(" ")) return true;
  const cls = dominantClass(surface.toLowerCase());
  return cls === null || cls === "PROPN";
}
