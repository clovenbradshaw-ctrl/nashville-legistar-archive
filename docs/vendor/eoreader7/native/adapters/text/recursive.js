// adapters/text/recursive.js — the text perceiver: void → being → fold per
// encounter (native/docs/THE-WHEEL.md) — the hub re-hollowed, the referent
// born (a being), the difference folded (the rim). One wheel per turn.
import { sha256hex } from "./sha256hex.js";
import { tokenize, buildFrequencyTable, functionWordSet } from "./material.js";
import { splitSentences } from "./spans.js";
import { createSurfaceEvidence, accumulateSurfaceEvidence, surfacesFromEvidence, discoverReferents, diaNorm } from "./surfaces.js";
import { heardSurfaces } from "../../organs/heard-surfaces.js";
import { createCompanyIndex } from "../../organs/company-index.js";
import { classifyWord, dominantClass } from "./wordclass.js";
import { GRAMMAR_MIN_SHARE } from "./grain-typing.js";
import { relationExtractorsFor } from "./relations-language.js";
import { fragmentRelations, FRAGMENT_DISCLOSURE } from "./fragment-relations.js";
import { directDescriptorOccurrences, descriptorOccurrence } from "./individuation.js";
import { createDescriptorAnchoring } from "./anchoring.js";
import { hyperedge } from "../../kernel/hypergraph.js";
import { tokenize as engTokenize, analyse as engAnalyse } from "./english-parser.js";

const slug = (value) => diaNorm(value).replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "");
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

// GFP figure gate — the received POS prior's function classes (the same set
// relations-gfp.js uses). A form the treebank says is dominantly a function
// class is not a figure; absent from the prior, it stays a candidate.
const FUNCTION_CLASSES = new Set(["ADP", "CCONJ", "SCONJ", "DET", "PRON", "AUX", "PART", "INTJ", "NUM", "PUNCT", "SYM", "X"]);
const dominantOf = (counts, total) => {
  if (!total) return null;
  let best = null, n = -1;
  for (const [tag, count] of Object.entries(counts)) if (count > n) { n = count; best = tag; }
  return best;
};

function surfaceMap(events = []) {
  const map = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    map.set(diaNorm(event.surface), event.referent_id);
  }
  return map;
}

function referentObjects(events = []) {
  const byId = new Map();
  for (const event of events) {
    if (event?.type !== "DEF.admit") continue;
    if (!byId.has(event.referent_id)) byId.set(event.referent_id, { schema: "EOReferent@1", id: event.referent_id, surfaces: [], provenance: [] });
    const ref = byId.get(event.referent_id);
    if (!ref.surfaces.includes(event.surface)) ref.surfaces.push(event.surface);
    ref.provenance.push(event.provenance);
  }
  return [...byId.values()].map((value) => Object.freeze({
    ...value,
    // THE CONSTITUTION-STANDING (2026-09-16): a being is on the record when
    // the reader admitted it BY EVIDENCE (recurrence past the material's own
    // floor — S24/P38: "presence is not establishment") — never by presence.
    // So every admitted referent carries `established_by_evidence` as its
    // standing, plus the mention count that earned it. The finer ladder
    // (hypothesized / sustained / contested) is the identity organ's to
    // adjudicate — its live alternatives, splits and refusals — never this
    // perceiver's, which only ever reports what it admitted.
    standing: "established_by_evidence",
    mentions: value.provenance.length,
    surfaces: Object.freeze(value.surfaces),
    provenance: Object.freeze(value.provenance),
  }));
}

// Exported for cast-prior.js — one implementation of "does this material
// attest this surface", not a second copy that can drift from the
// perceiver's own reading of the same question.
export function containsSurface(text, surface) {
  const hay = diaNorm(text);
  const needle = diaNorm(surface);
  if (!needle) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(needle)}([^\\p{L}\\p{N}]|$)`, "u").test(hay);
}

// ── EVERY KNOWN SURFACE IN ONE PASS (2026-09-07) ─────────────────────────
// `currentReferents` and `referentsInSpan` asked `containsSurface` once per
// known surface per sentence — normalising the sentence again and compiling a
// fresh RegExp each time. The cast grows with the read, so that is
// O(surfaces) regexes per sentence: profiled at 240 KB of War and Peace it
// was 14% of the read and grew 6.4x for 1.79x the sentences.
//
// The index is built ONCE per refresh, when the surface map changes, and a
// sentence is scanned once: at each word start, the surfaces whose first
// token is that word are checked with `startsWith` and the same after-
// boundary `containsSurface` uses. It is EXACT to `containsSurface`'s rule
// — (^|non-alnum) needle (non-alnum|$) over diaNorm'd text — because a
// needle that begins with a letter or digit can only match at a word start.
// A needle that begins with anything else keeps the regex path, per needle.
// Order is carried as the surface map's own insertion order, so every caller
// that depended on map order (`referentsInSpan`'s grouping,
// `witnessRelatedPairs`' first-three) reproduces it by sorting hits by it.
const ALNUM_RE = /[\p{L}\p{N}]/u;
const WORD_START_RE = /[\p{L}\p{N}]+/gu;
const alnumAt = (s, i) => i < s.length && ALNUM_RE.test(String.fromCodePoint(s.codePointAt(i)));
export function surfaceIndex(surfaces) {
  const byFirst = new Map();   // first token -> [needle]
  const fallback = [];         // needles not beginning with a letter/digit: the regex path
  const order = new Map();     // needle -> position in the given order
  for (const surface of surfaces) {
    const needle = diaNorm(surface);
    if (!needle || order.has(needle)) continue;
    order.set(needle, order.size);
    const m = needle.match(/^[\p{L}\p{N}]+/u);
    if (!m) { fallback.push(needle); continue; }
    if (!byFirst.has(m[0])) byFirst.set(m[0], []);
    byFirst.get(m[0]).push(needle);
  }
  return Object.freeze({ byFirst, fallback, order });
}
/** The needles (diaNorm'd surfaces) present in `text`, in the index's own order. */
export function surfacesIn(text, index) {
  const hay = diaNorm(text);
  const present = new Set();
  WORD_START_RE.lastIndex = 0;
  let m;
  while ((m = WORD_START_RE.exec(hay))) {
    const cands = index.byFirst.get(m[0]);
    if (!cands) continue;
    for (const needle of cands) {
      if (present.has(needle)) continue;
      if (hay.startsWith(needle, m.index) && !alnumAt(hay, m.index + needle.length)) present.add(needle);
    }
  }
  for (const needle of index.fallback) if (containsSurface(hay, needle)) present.add(needle);
  return [...present].sort((a, b) => index.order.get(a) - index.order.get(b));
}
/** The per-refresh matcher: the index over the surface map, and each referent's own needles. */
function surfaceMatcher(map, referents) {
  return Object.freeze({ index: surfaceIndex(map.keys()), map, referents: referents.map((ref) => ({ ref, needles: new Set(ref.surfaces.map(diaNorm).filter(Boolean)) })) });
}

function currentReferents(text, matcher) {
  if (!matcher) return [];
  const present = new Set(surfacesIn(text, matcher.index));
  // The referent's own surfaces may not all be keys of the map (the map is
  // surface -> id after coreference); those are asked one by one, as before.
  return matcher.referents.filter(({ ref, needles }) => [...needles].some((n) => present.has(n) || (!matcher.index.order.has(n) && containsSurface(text, n)))).map(({ ref }) => ref);
}

function referentsInSpan(span, matcher) {
  const matches = new Map();
  for (const surface of surfacesIn(span, matcher.index)) {
    const ref = matcher.map.get(surface);
    if (!matches.has(ref)) matches.set(ref, []);
    matches.get(ref).push(surface);
  }
  return matches;
}

function resolveParticipant(surface, matcher, sequencePosition, relationIndex, role) {
  // EVERY participant carries an occurrence — content-addressed (A4,
  // THE-ADDRESS.md): the identity hashes the surface, the slot, and the
  // reading's position, never a bare slot that would collide across
  // readings. The ledger resolves standing by matching a binding's
  // `occurrence` to the participant's — a participant without one can
  // never be bound (measured: 82 bindings created, 0 chain sites formed,
  // because the referent/hypothesis branches returned no occurrence and
  // the ledger's resolveEndpoint looked one up and found none).
  const occurrence = sha256hex(`occ|surface:${surface}|seq:${sequencePosition}|rel:${relationIndex}|role:${role}`);
  const exact = matcher.map.get(diaNorm(surface));
  if (exact) return { ref: exact, occurrence, role, standing: "referent", surface, resolution: "exact_surface" };
  const candidates = referentsInSpan(surface, matcher);
  if (candidates.size === 1) {
    const [[ref, matchedSurfaces]] = candidates;
    return { ref, occurrence, role, standing: "referent", surface, resolution: "unique_surface_in_span", matchedSurfaces };
  }
  // ── CONTAINMENT TIER (S105's third tier, in the perceiver, 2026-09-12):
  // the clause-end surface ("her sister", "the use of a book") may CONTAIN a
  // cast surface ("sister") or be contained by it. Ends point at referents,
  // never strings (LAVAR §13) — a participant that embeds a known being IS
  // about that being. Committed only when exactly one referent matches (an
  // ambiguous containment stays unresolved, never guessed — P38).
  const ds = diaNorm(surface);
  const contained = [];
  if (ds.length >= 3) {
    for (const [k, ref] of matcher.map) {
      const dk = diaNorm(k);
      if (dk.length >= 3 && (ds.includes(dk) || dk.includes(ds))) contained.push([ref, k]);
    }
    const uniq = new Set(contained.map(([ref]) => ref));
    if (uniq.size === 1) {
      return { ref: [...uniq][0], occurrence, role, standing: "referent", surface, resolution: "containment_surface_in_span", matchedSurfaces: contained.map(([, k]) => k) };
    }
  }
  // ── POSSESSIVE DEFINITE DESCRIPTIONS ARE HOLDINGS (S88's fourth signal,
  // 2026-09-12): "her sister" is a parameterized being — the possessive
  // resolves to its owner, the noun is the slot. If the noun part IS a cast
  // surface, resolve to that being; otherwise mint a HOLDING — an open
  // identity hypothesis "the <noun> of <owner>", awaiting a witness that
  // resolves it (canonicalizationFloor 2). All mentions share the one
  // holding, so chains can form on it.
  const POSS = /^(my|her|his|our|their|your)\s+([\p{L}][\p{L}' -]{1,24})$/iu;
  const pm = POSS.exec(surface);
  if (pm) {
    const noun = diaNorm(pm[2]);
    const inside = matcher.map.get(noun);
    if (inside) return { ref: inside, occurrence, role, standing: "referent", surface, resolution: "possessive_head_surface", possessiveAnchor: pm[1].toLowerCase() };
    return { ref: `identity:poss:${noun}:${pm[1].toLowerCase()}`, occurrence, role, standing: "hypothesis", surface, resolution: "possessive_holding", possessiveAnchor: pm[1].toLowerCase() };
  }
  const lexical = slug(surface) || "unknown";
  // A4 (THE-ADDRESS.md): an unresolved participant occurrence is content —
  // its id hashes the surface it wears and the slot it fills, never a bare
  // position that would collide across readings and across surfaces.
  return {
    ref: occurrence,
    occurrence,
    surfaceKey: `surface:${lexical}`,
    role,
    standing: "unresolved_surface",
    surface,
    candidateReferents: [...candidates.keys()],
  };
}

function earnedClosedClass(table) {
  if (!table?.total || table.freq.size === 0) return new Set();
  const candidate = functionWordSet(table);
  return candidate.size * 2 < table.freq.size ? candidate : new Set();
}

// A relation form's composition standing, from the received POS prior.
// Absent prior, or absent form: eligible (nothing has been shown against it).
function relationStanding(verb, posPrior) {
  const counts = posPrior?.forms?.[diaNorm(String(verb ?? ""))];
  if (!counts) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total) return Object.freeze({ eligible: true, basis: "no received evidence about this form; absence is not a refusal" });
  let dominant = null, best = -1;
  for (const [tag, n] of Object.entries(counts)) if (n > best) { best = n; dominant = tag; }
  const eligible = dominant === "VERB";
  return Object.freeze({
    eligible,
    dominantClass: dominant,
    share: best / total,
    basis: eligible
      ? "treebank-dominant VERB — eligible as portable relation memory"
      : `treebank-dominant ${dominant} — an auxiliary or non-verb form does not become familiarity by recurring`,
    giver: "UD_English-EWT via bin/priors/pos/en-ud-ewt.json",
  });
}

function lexicalNounOccurrences(text, sequencePosition, encounterRef, posPrior, source) {
  if (!posPrior?.forms) return [];
  const out = [];
  for (const match of text.matchAll(WORD_RE)) {
    const raw = match[0];
    const form = diaNorm(raw);
    const counts = posPrior.forms[form];
    if (!counts) continue;
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const nounShare = total ? (counts.NOUN ?? 0) / total : 0;
    if (nounShare <= GRAMMAR_MIN_SHARE) continue;
    const surfaceKey = `surface:${slug(raw) || "unknown"}`;
    // A4 (THE-ADDRESS.md): a lexical occurrence is content — the id hashes
    // the source, the byte span and the surface itself, so a re-read of the
    // same occurrence dedups and nothing else collides.
    const content = `lex|src:${source ?? ""}|seq:${sequencePosition}|off:${match.index}|surface:${raw}`;
    out.push(Object.freeze({
      schema: "EOLexicalOccurrence@1",
      id: sha256hex(content),
      surfaceKey,
      surface: raw,
      upos: "NOUN",
      standing: "occurrence",
      encounterRef,
      offset: match.index,
      witness: sha256hex(`${content}|wit`),
    }));
  }
  return out;
}

function taskTargetSurfaceKeys(orientation = {}) {
  const out = new Set();
  for (const task of orientation.activeTasks ?? []) {
    for (const target of task.targets ?? []) {
      if (typeof target === "string" && target.startsWith("surface:")) out.add(target);
    }
  }
  return out;
}

/**
 * A Fold task may make a previously unremarkable surface worth checking for.
 * This emits only occurrence evidence. It does NOT promote the surface to a
 * referent or assert that two occurrences corefer.
 */
function taskTargetOccurrences(text, sequencePosition, encounterRef, orientation, alreadySeen = new Set(), source = null) {
  const out = [];
  for (const surfaceKey of taskTargetSurfaceKeys(orientation)) {
    if (alreadySeen.has(surfaceKey)) continue;
    const surface = surfaceKey.slice("surface:".length).replace(/_/g, " ");
    if (!surface || !containsSurface(text, surface)) continue;
    // A4 (THE-ADDRESS.md): a task-nominated occurrence is content — the id
    // hashes the source, the encounter and the targeted surface, so the same
    // targeted occurrence re-read dedups and nothing else collides.
    const content = `task-target|src:${source ?? ""}|seq:${sequencePosition}|surface:${surfaceKey}`;
    out.push(Object.freeze({
      schema: "EOTaskTargetOccurrence@1",
      id: sha256hex(content),
      surfaceKey,
      surface,
      standing: "task_nominated_occurrence",
      encounterRef,
      witness: sha256hex(`${content}|wit`),
      provenance: Object.freeze({ giver: "active-reading-task", basis: "targeted recurrence check" }),
    }));
  }
  return out;
}

function mergeRelationEvidence(store, candidates = []) {
  for (const candidate of candidates) {
    if (!candidate?.verb) continue;
    if (!store.has(candidate.verb)) store.set(candidate.verb, { surfaceForms: new Set(), relatedPairs: new Set(), upos: candidate.upos ?? null, verbDominant: candidate.verbDominant !== false });
    const record = store.get(candidate.verb);
    for (const surface of candidate.surfaceForms ?? []) record.surfaceForms.add(surface);
    if (candidate.upos) record.upos = candidate.upos;
    if (candidate.verbDominant === false) record.verbDominant = false;
  }
}

// FOLD-CONDITIONED ADMISSION — "the high determines the probability of the
// low", done as conditioning rather than as a lookup list.
//
// The engine's own gate counts ONE kind of evidence: distinct capitalized
// surfaces the verb was seen beside. That is anchor evidence, and it starves
// on first-person material where the cast is rarely named in the same clause
// as its own predicates (measured on Dracula's opening 700 sentences: 74
// candidates nominated, 2 admitted).
//
// A verb witnessed BETWEEN TWO BEINGS THIS READING HAS ALREADY ESTABLISHED is
// also relation evidence, and it comes from the material, not from a table —
// the Entity terrain, already earned, conditioning what counts as evidence at
// the Link terrain below it. Counted at the SAME declared strength as anchor
// evidence (minSurfaces), so no new number is introduced and neither path is
// privileged. Measured on the same slice: 2 -> 21 verbs, every one warranted
// by Dracula's own text.
//
// NOT a loosened gate and NOT a received lexicon standing in for reading
// (READING-POLICY P2: "statistics derived from the material, not lookup
// lists"; P3: "never patch a missing prior by loosening an engine gate").
// The grammar prior's role here is unchanged and one-directional: it may
// REFUSE a candidate (verbDominant === false) and may never admit one.
function admittedRelationVerbs(store, minSurfaces, posPrior, language = null) {
  const verbs = new Set();
  for (const [verb, record] of store) {
    if (record.verbDominant === false) continue; // grammar refuses; it never admits
    const anchorEvidence = record.surfaceForms.size;
    const relationEvidence = record.relatedPairs?.size ?? 0;
    if (anchorEvidence >= minSurfaces || relationEvidence >= minSurfaces) verbs.add(verb);
  }
  // §8 — RECEIVED PRIORS ARE THE FLOOR (LAVAR §8: "Received priors stay as
  // the floor... the first reading of anything has no live prior to stand
  // on."). The earned tier above is what the material itself nominated
  // (recurrence, capitalisation-gated); this ADDS every form the received
  // POS prior attests as (VERB+AUX)-dominant at the project's own
  // GRAMMAR_MIN_SHARE — a received fact, not a guess, so no recurrence floor
  // applies to it. Accretes above the earned set, never replaces it; Field
  // connectors (ADP-dominant) stay out, so grain typing is untouched.
  // Rationale named (LAVAR §8), never tuned against a golden. Without this,
  // a pronoun-narrated text (AIW ch1) reads ZERO relation edges at the
  // earned-only floor — measured 2026-09-12 (the "best version" experiment).
  // THE PRIOR'S OWN DECLARED LANGUAGE GATES THE TIER (Chomsky, 2026-09-20):
  // an English treebank's table is "honestly no gate" on a Russian page
  // (the-fold POLICIES.md P74) — so a prior whose declared `language`
  // contradicts the material's declared language is a typed refusal, never
  // applied. A prior that declares no language, or material whose language
  // is undeclared, falls open exactly as before (P41's posture: silence
  // convicts nothing).
  if (posPrior && (!posPrior.language || !language || posPrior.language === language)) {
    for (const form of receivedVerbTier(posPrior)) verbs.add(form);
  }
  return verbs;
}
// The received tier is a fact about the PRIOR, not the material: the same
// ~16k-form table answered the same way on every reprojection (profiled at
// 7.8% of a 400KB read, 2026-09-28). Derived once per prior object, kept
// weakly, in the prior's own iteration order — byte-identical to the loop.
const RECEIVED_VERB_TIERS = new WeakMap();
function receivedVerbTier(posPrior) {
  const hit = RECEIVED_VERB_TIERS.get(posPrior); if (hit) return hit;
  const forms = posPrior.forms ?? posPrior;
  const tier = [];
  for (const [form, tags] of Object.entries(forms)) {
    const counts = Object.values(tags);
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) continue;
    const verbish = (tags.VERB ?? 0) + (tags.AUX ?? 0);
    if (verbish / total >= GRAMMAR_MIN_SHARE) tier.push(form);
  }
  RECEIVED_VERB_TIERS.set(posPrior, tier);
  return tier;
}

/**
 * Witness, over the new batch only, which candidate verbs occur in a sentence
 * that names at least two already-established referents — recording the PAIR,
 * so "witnessed relating these two beings" is counted once however often that
 * one sentence repeats, exactly as distinct surfaces are counted once each.
 */
function witnessRelatedPairs(store, sentences, refs, matcher = null) {
  if (!refs?.size || !store.size) return;
  const index = matcher?.index ?? surfaceIndex(refs.keys());
  // The verbs were diaNorm'd once per verb per sentence; once per verb.
  const verbs = [...store].map(([verb, record]) => [diaNorm(verb), record]);
  for (const sentence of sentences) {
    const hay = diaNorm(sentence.text);
    // The first three hits in map order — the original stopped after the third.
    const present = surfacesIn(sentence.text, index).slice(0, 3).map((surface) => refs.get(surface));
    const distinct = [...new Set(present)];
    if (distinct.length < 2) continue;
    const pairKey = distinct.slice(0, 2).sort().join("\u0000");
    for (const [verb, record] of verbs) {
      if (!record.relatedPairs) record.relatedPairs = new Set();
      if (hay.includes(verb)) record.relatedPairs.add(pairKey);
    }
  }
}

export function createCausalTextPerceiver({ minRelationSurfaces = 2, refreshEvery = 1, reprojectEvery = null, posPrior = null, descriptorAnchoring = null, addresses = "birth", idFactory = null, recipe = null, language = null, roleConfig = null, parseModel = null, fragmentSeam = true } = {}) {
  // `refreshEvery` (2026-09-09): 1 is the default now — batching is an
  // engineering compromise, never a model of how reading works ("people
  // don't read in 25-sentence batches" — user direction, verbatim, the
  // session this changed). It existed because refresh() used to re-tokenize
  // and re-scan the WHOLE prefix every call — O(n²), 75s on Frankenstein,
  // ~80min on Les Misérables (see the surfaceEvidence/foldedTo split above)
  // — and batching amortized that cost. That fix already landed: refresh()
  // now folds only the NEW slice since the last call
  // (`priorSentences.slice(foldedTo)`), so the old O(n²) justification for
  // batching at all is stale, and refreshEvery=25 was never re-measured
  // after it stopped being load-bearing.
  //
  // Measured this session, real book (Alice in Wonderland, 1687 sentences):
  // refreshEvery=1 costs 5.68s vs 2.34s at refreshEvery=25 — 2.4x slower,
  // nowhere near the old O(n²) blowup — and finds MORE structure doing it
  // (11950 vs 11669 graphEntries): continuous updating isn't just more
  // faithful to how reading actually works, it recovers real signal even on
  // long material, because the old batching held the verb vocabulary and
  // referent cast frozen at whatever a stale earlier refresh had earned.
  //
  // The incident that surfaced it: a 14-sentence children's book
  // (18-childrens-books/.../273_I-Love-My-Mom.txt) read at refreshEvery=25
  // produced ZERO relation edges and ZERO referent bindings — the text
  // ended before the reader's very first real refresh (at sentence 25)
  // ever fired, so extractRelations ran on every sentence with an
  // eternally-empty verb vocabulary. Not a bug in that one book: any
  // material shorter than the batch size gets read into a permanently
  // empty fold, and any material NOT an exact multiple of the batch size
  // loses coverage on however many trailing sentences fall short of the
  // next boundary (invisible on a 1963-sentence novel, total on a
  // 14-sentence one). refreshEvery=1 removes the batch boundary rather
  // than picking a smaller one — no batch size is safe against every
  // material length, and derived-not-hand-picked was never possible here
  // since there is no material-length-derivable minimum: only zero avoids
  // the failure class outright. A caller reading material it has already
  // measured to be very long AND performance-critical may still declare a
  // larger refreshEvery explicitly — that remains a caller's stated
  // tradeoff, never this file's default. See eoreader7/READING-POLICY.md
  // A26 and CLAUDE.md's "added 2026-09-09" entry for the full writeup.
  //
  // `addresses` (2026-09-07): "birth" — the default, decided by measurement
  // (the-fold POLICIES.md P168) — hands the previous refresh's addresses to
  // discoverReferents so a being keeps the id it was born with (surfaces.js,
  // `prior`); "founder" mints a cluster's id from whichever member founds it
  // at each refresh, the reading as it was until P168, kept so the
  // oscillation it produces stays reproducible (tests/referent-merge.test.js).
  if (addresses !== "founder" && addresses !== "birth") throw new TypeError('addresses is "founder" or "birth"');
  if (!Number.isInteger(refreshEvery) || refreshEvery < 1) throw new TypeError("refreshEvery must be a positive integer");
  // reprojectEvery defaults to refreshEvery so every existing caller is
  // byte-identical; only a caller that opts in batches the expensive tier.
  if (reprojectEvery != null && (!Number.isInteger(reprojectEvery) || reprojectEvery < 1)) throw new TypeError("reprojectEvery must be a positive integer when declared");
  const reprojectEveryFinal = reprojectEvery ?? refreshEvery;
  // GIVER-NAME DISCIPLINE, ONE SCHEMA TWO SPELLINGS: POSPrior@1's own
  // builder (live_priors/scripts/build-pos-prior.mjs) names the giver in
  // `giver.resource` (with per-file sha256 provenance in `giver.files`),
  // while the Greek fixture spells it `provenance.source`. Both are the
  // same contract — a POSPrior@1 that names no giver is refused — so both
  // spellings pass and neither shape is excluded (reconciled 2026-09-20;
  // the fold's served eng prior carried `giver` only and every consumer
  // silently fell back to presence — the-fold POLICIES.md P237's standing
  // "page's constitutional reader is not running" finding).
  if (posPrior && (posPrior.schema !== "POSPrior@1" || !(posPrior.provenance?.source || posPrior.giver?.resource))) throw new TypeError("posPrior must be a giver-named POSPrior@1");
  // THE LANGUAGE DISPATCH (2026-09-16): all cognition reads GFP-shaped by
  // default; English-SVO (or any positional language with a measured
  // RoleConfig@1) comes online ONLY when `roleConfig` is declared for the
  // language (relations-language.js). `language` names the material for the
  // record; it does not BY ITSELF bring SVO online — only a RoleConfig does.
  const { mode, discoverRelationVocab, extractRelations } = relationExtractorsFor({ language, roleConfig, posPrior, classifyWord, dominantClass });
  // CONTENT-ADDRESSED IDENTITY (2026-09-13, S114 — the git object model,
  // GitHub-inspired). The perceiver's edge ids were position-derived and
  // source-blind (`edge:text:2:0`): the same id in War and Peace and in
  // Alice in Wonderland, so the hyperlexicon's accumulator — which unions
  // witnesses by id — read two books' chains as ONE chain sharing edges.
  // Measured: 87 edge-id / 14 witness collisions between the two books.
  // The identity is now a content hash, exactly as git names objects:
  // the SHA-256 of the edge's own content (source, relation, subject,
  // object, offset). SAME content -> SAME id (a re-read of the same
  // clause dedups, so the fold's upsert-by-id is correct); DIFFERENT
  // content -> different id (no collision is possible); REPRODUCIBLE (no
  // randomness — a test can pin the id). A caller may pass `idFactory`
  // for a different identity scheme; the default is content-addressing,
  // and the perceiver never falls back to a position-derived id silently.
  const newId = (content) => (idFactory && typeof idFactory === "function" ? idFactory(content ?? "") : content ? sha256hex(content) : sha256hex(`${Date.now()}:${Math.random()}`));
  // OPT-IN: descriptor anchoring (one-hop activation recall binding
  // definite/possessive descriptors to the admitted cast — anchoring.js).
  // Off by default so every existing caller is byte-identical; when
  // supplied, its floors are DECLARED by the caller (anchoring.js throws
  // otherwise — pronouns.js's own contract, applied unchanged).
  const anchoring = descriptorAnchoring ? createDescriptorAnchoring(descriptorAnchoring) : null;
  // OPT-IN: SVO-GATED NAME ADMISSION (2026-09-23, adapters/text/parse-gated-
  // names.js's own measurement carried here). `surfacesFromEvidence` below
  // is orthography-only -- it imports no parser and never reads the
  // material's own syntax, the same is true of existence-grain.js's naming
  // signal, and the user's own read of the code named this gap directly:
  // "we have to go through SVO for English to get there." Off by default
  // (parseModel: null) so every existing caller is byte-identical; when a
  // caller supplies a loaded english-parser.js model, a capitalised
  // candidate is admitted only when the material's OWN per-sentence parse
  // tagged at least one of its occurrences PROPN -- the parse licenses,
  // capitalisation corroborates, never a coequal vote. Measured against a
  // 365-item, 9-annotator blind gold (Henry IV Part 1, modern spelling):
  // precision 69.4%, recall 87.7%, F1 77.5 -- the best of nine admission
  // formulas tried, ahead of the best combination of capitalisation-only
  // detectors (F1 76.3). Folded incrementally, one new sentence at a time,
  // in the SAME loop that already folds surfaceEvidence below -- never a
  // whole-prefix re-parse.
  const synPropnSeen = parseModel ? new Set() : null;
  const priorSentences = [];
  let priorText = "";
  let relationRefreshFrom = 0;
  let reprojectedTo = 0;
  const relationEvidence = new Map();
  let cache = { closed: new Set(), refs: new Map(), referents: [], matcher: surfaceMatcher(new Map(), []), gaps: [], merges: [], reassignments: [], verbs: new Set() };
  // discoverReferents re-clusters everything on every refresh, so the same
  // merge is rediscovered each time. It lands ONCE, in the observation of the
  // sentence whose refresh first proved it.
  const emittedMerges = new Set();
  // THE FOLD IS THE ACTIVATION — nothing is re-read. Each sentence's
  // surface evidence and word counts are folded in ONCE (arithmetic tier:
  // monotone accumulation, S10); refresh() only PROJECTS from the
  // accumulated evidence. The old shape re-tokenized and re-scanned the
  // whole prefix every 25 encounters — O(n²), measured: 75s on
  // Frankenstein, ~80min on Les Misérables, which is re-reading wearing a
  // refresh's name (S4). The split is exact: the per-sentence evidence
  // depends on nothing but the sentence; functionWords bite only in the
  // projection — proven by a byte-identical full-Frankenstein diff before
  // this landed.
  const surfaceEvidence = createSurfaceEvidence();
  const runningFreq = new Map();
  let runningTotal = 0;
  let foldedTo = 0;

  const refresh = () => {
    for (const sent of priorSentences.slice(foldedTo)) {
      accumulateSurfaceEvidence([sent], surfaceEvidence);
      for (const w of tokenize(sent.text)) { runningFreq.set(w, (runningFreq.get(w) || 0) + 1); runningTotal += 1; }
      if (parseModel) {
        // A sentence the parser can't tokenise or tag never blocks the
        // read (same typed-degradation discipline heardSurfaces' own
        // try/catch below already follows) -- it just contributes no
        // synPropn evidence, and capitalisation-only admission still
        // applies to whatever it would have nominated.
        try {
          const toks = engTokenize(sent.text);
          const rows = engAnalyse(parseModel, toks.map((t) => t.form));
          for (const r of rows) if (r.upos === "PROPN") synPropnSeen.add(r.form.toLowerCase());
        } catch {}
      }
    }
    foldedTo = priorSentences.length;
    const table = { freq: runningFreq, total: runningTotal };
    const closed = earnedClosedClass(table);
    // GFP FIGURES (2026-09-16): recurrence + company from the accumulated
    // corpus — a figure is a content token heard at least `minRec` times,
    // never capitalisation-gated (the GFP reader's own rule, relations-gfp.js).
    // The same received POS prior that gates function classes elsewhere keeps
    // figures out of the closed class; a missing prior keeps the freq floor.
    const minFigureRec = 2;
    const figures = new Set();
    for (const [w, c] of runningFreq) {
      const lower = w.toLowerCase();
      if (c < minFigureRec || lower.length < 3) continue;
      if (closed.has(lower)) continue;
      if (posPrior?.forms?.[lower]) {
        const counts = posPrior.forms[lower];
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const func = FUNCTION_CLASSES.has(dominantOf(counts, total));
        if (func) continue;
      }
      figures.add(lower);
    }
    cache = { ...cache, figures };
    // THE EXPENSIVE RE-PROJECTION RUNS AT A DECLARED CADENCE, NEVER EVERY
    // REFRESH. The accumulation above is incremental (foldedTo); the cast
    // re-derivation — heardSurfaces' full-prefix scan plus discoverReferents'
    // from-scratch re-cluster — is O(prefix) + O(cast²). With refreshEvery:1
    // that term ran every sentence. Measured 2026-09-13: two Wikipedia-scale
    // pages held the CPU at ~99% for ~20 minutes with the cast past 400
    // referents and not one section written. reprojectEvery batches the
    // expensive tier (default = refreshEvery); between reprojections the last
    // cast is reused while the relation batch and witness pairing below still
    // fold every new sentence. The first content-bearing refresh always
    // reprojects, so a short text is never starved — the same refusal that
    // killed refreshEvery=25 for short books applies to this tier too.
    const newSinceReproject = priorSentences.length - reprojectedTo;
    const runReproject = newSinceReproject >= reprojectEveryFinal || (reprojectedTo === 0 && newSinceReproject > 0);
    let surfaces = cache.surfaces ?? [];
    let nextRefs = cache.refs ?? new Map();
    let referents = cache.referents ?? [];
    let discovered = null;
    let reassignments = cache.reassignments ?? [];
    if (runReproject) {
      surfaces = surfacesFromEvidence(surfaceEvidence, { functionWords: closed });
      if (parseModel) {
        // parse-gated-names.js's own rule, applied incrementally: keep a
        // capitalised-run candidate only if AT LEAST ONE of its
        // constituent words has been seen tagged PROPN by the material's
        // own parse. A multi-word run survives on any one licensed
        // constituent (the same "run.length <= 4" prefix-candidate shape
        // surfaces.js already builds); an unlicensed single word is
        // dropped, not silently downgraded.
        surfaces = surfaces.filter((s) => (s.surface.toLowerCase().match(WORD_RE) ?? []).some((w) => synPropnSeen.has(w)));
      }
      let heard = [];
      if (posPrior) {
        // The past is read once (organs/company-index.js): the index lives in
        // the cache and heardSurfaces adds only the sentences it has not seen.
        if (!cache.companyIndex) cache = { ...cache, companyIndex: createCompanyIndex() };
        try { heard = heardSurfaces(priorSentences, { minMentions: 2, minShare: 0.3, minMembers: 2, posPrior, classifyWord, dominantClass, index: cache.companyIndex }); }
        catch { heard = []; }
      }
      if (heard.length && process.env.ER7_DEBUG_READER === "1") console.error(`[recursive] heardSurfaces added ${heard.length}: ${heard.map((h)=>h.surface).join(',')}`);
      const combinedSurfaces = [...surfaces, ...heard];
      discovered = discoverReferents(combinedSurfaces, addresses === "birth" ? { prior: { refs: cache.refs, born: cache.born ?? new Map(), next: cache.bornNext ?? 0 } } : {});
      // REASSIGNMENT ACROSS REPROJECTIONS, RECORDED (P165). discoverReferents
      // re-clusters from scratch every reprojection, longest surface first. A
      // fragment that cleared its floor is processed before the fuller name
      // that would absorb it; the old map in hand here records any surface
      // whose id CHANGED, witnessed by that surface — never inferred downstream.
      nextRefs = surfaceMap(discovered.events);
      const originalSurface = new Map();
      for (const e of discovered.events) if (e?.type === "DEF.admit" && !originalSurface.has(diaNorm(e.surface))) originalSurface.set(diaNorm(e.surface), e.surface);
      reassignments = [];
      for (const [key, from] of cache.refs ?? []) {
        const to = nextRefs.get(key);
        if (to && to !== from) reassignments.push({ from, to, surface: originalSurface.get(key) ?? key, basis: "reassigned on refresh — the fuller name cleared its floor and this surface now points at a new address" });
      }
      referents = referentObjects(discovered.events);
      if (referents.length && process.env.ER7_DEBUG_READER === "1") console.error(`[recursive] refresh cast ${referents.length}: ${referents.map((r)=>r.surfaces[0]).join(",")}`);
      reprojectedTo = priorSentences.length;
    }
    const batchSentences = priorSentences.slice(relationRefreshFrom);
    const batchText = batchSentences.map((sentence) => sentence.text).join("\n");
    if (batchText && surfaces.length) {
      const relationResult = discoverRelationVocab(batchText, {
        surfaces,
        functionWords: closed,
        minSurfaces: 1,
        posPrior,
        figures: cache.figures ?? null,
      });
      mergeRelationEvidence(relationEvidence, relationResult.candidates);
    }
    // Fold-conditioned evidence, over the SAME new batch the vocabulary scan
    // uses — never a rescan of everything read so far.
    const matcher = surfaceMatcher(nextRefs, referents);
    witnessRelatedPairs(relationEvidence, batchSentences, nextRefs, matcher);
    relationRefreshFrom = priorSentences.length;
    cache = {
      closed,
      refs: nextRefs,
      referents,
      matcher,
      surfaces,
      figures,
      gaps: discovered?.gaps ?? cache.gaps,
      // THE MERGE RECORD, KEPT (P165). discoverReferents detects when two
      // surface clusters name one being and records it — `merges.push({kept,
      // folded, witness})` — and the projection reads it (a node at cursor 500
      // may be two nodes at cursor 200). Only recomputed at a reprojection.
      merges: discovered?.merges ?? cache.merges,
      reassignments,
      born: discovered?.addresses?.born ?? cache.born,
      bornNext: discovered?.addresses?.next ?? cache.bornNext,
      verbs: admittedRelationVerbs(relationEvidence, minRelationSurfaces, posPrior, language),
      companyIndex: cache.companyIndex,
    };
  };

  return Object.freeze({
    id: "text/recursive",
    // Restore the perceiver's causal accumulators from the encounters that
    // produced the persisted log. A Fold seed alone cannot restore these
    // accumulators; without this replay, a resumed reader is a new instrument.
    async restore(entries = []) {
      for (const entry of entries) if (entry?.schema === "Encounter@1") await this.perceive(entry);
    },
    async perceive(encounter, orientation = {}) {
      if (encounter?.modality !== "text" || typeof encounter.material !== "string") return [];
      const sequencePosition = encounter.sequencePosition ?? priorSentences.length;
      const encounterRef = `encounter:${sequencePosition}`;
      if (priorSentences.length === 0 || priorSentences.length % refreshEvery === 0) refresh();

      const parsedRelations = extractRelations(encounter.material, { verbs: cache.verbs, functionWords: cache.closed, phrasalPredicates: true, figures: cache.figures ?? cache.verbs });
      // THE TRANSFER (2026-10-01): read good books so we can understand bad
      // grammar. The fragment seam hears the clause shapes the formal reader
      // gated on — imperative, intransitive, copula-deleted — in the deformed
      // registers (SMS fragments, Singlish, IRC) where extractRelations is
      // deaf. It emits the SAME relation-edge shape (label/end1/end2/offset/
      // polarity/grain/basis), so the fold gains a relation universe where
      // organic chat had none. The seam's own gate is the house's one
      // direction: the received POS prior REFUSES (a prior-attested non-verb
      // or interjection never heads a relation) and never admits; a form
      // absent from the prior is a gap, never a refusal.
      const relations = [
        ...parsedRelations,
        ...(fragmentSeam ? fragmentRelations(encounter.material, { prior: posPrior, verbs: cache.verbs }).filter((r) => !parsedRelations.some((p) =>
          (p.end1 ?? p.subject) === r.end1 && (p.label ?? p.verb) === r.label && (p.end2 ?? p.object) === r.end2 && p.offset === r.offset)) : []),
      ];
      // GUID IDENTITY (2026-09-13, S114): a GUID edge id and witness, so
      // the identity is collision-proof across readings. The hyperlexicon's
      // accumulator unions witnesses by id; a position-derived id collided
      // across books (measured: 87 edge-id / 14 witness collisions between
      // W&P and Alice). The source is still named on the edge for
      // provenance; the identity is never derived from it or position.
      const sourceScope = String(encounter.source ?? "text");
      // THE BYTE ADDRESS (2026-09-29, the provenance wiring): rel.offset is
      // sentence-relative (match.index in the encounter's material), so the
      // edge carries the ABSOLUTE byte offset too — the encounter anchor's
      // start plus the relation offset. scope.offset stays the relative
      // position (edge identity); scope.byteOffset is the address downstream
      // renders as `source#start`. Never a guessed address: when the anchor
      // or the offset is absent, byteOffset is null and the note carries no
      // span — the holograph renders the typed gap instead.
      const encounterBase = Number(encounter?.anchor?.start);
      const edges = relations.map((rel, index) => {
        // content-addressed: the edge's own content (source, relation,
        // subject, object, offset) IS its identity — same content dedups,
        // different content never collides (S114, the git object model).
        // A5 (THE-ADDRESS.md): an ACT's hash covers the act AND the recipe
        // under which it was performed — two instruments, two hashes, never
        // a collision to a shared bytes hash. The recipe is declared by the
        // assembly (read-real's `recipe`), so the same clause read under
        // two recipes is two acts.
        const content = `edge|src:${sourceScope}|rel:${rel.label ?? rel.verb}|end1:${rel.end1 ?? rel.subject}|end2:${rel.end2 ?? rel.object}|off:${rel.offset}|recipe:${recipe ?? ""}`;
        const eid = newId(content);
        const ewit = newId(`${content}|wit`);
        const grain = rel.grain && !rel.grain.grain_gap ? rel.grain.grain : (rel.grain_gap ? null : "Figure");
        return hyperedge({
          id: eid,
          relation: rel.label ?? rel.verb,
          participants: [
            resolveParticipant(rel.end1 ?? rel.subject, cache.matcher, sequencePosition, index, "end1"),
            resolveParticipant(rel.end2 ?? rel.object, cache.matcher, sequencePosition, index, "end2"),
          ],
          witness: ewit,
          scope: { sequencePosition, offset: rel.offset, byteOffset: (Number.isFinite(encounterBase) && Number.isFinite(rel.offset)) ? encounterBase + rel.offset : null },
          eo: { op: rel.grain?.operator ?? "CON", grain: grain ?? "Figure" },
        // compositionStanding: whether this relation FORM is eligible to be
        // carried as portable experience or composed with another relation.
        // experience-priors.js reads exactly this field ("auxiliaries/noise
        // do not become familiarity merely because they appeared often") but
        // nothing on this side ever set it, so a reader's carried memory
        // filled with `were`/`would`/`has`/`could` — measured, not
        // hypothesized (the first experienced-new-book run's own carried
        // memory was 4 auxiliaries and nothing else). Decided by the SAME
        // received POS prior the descriptor-head gate already uses: a form
        // the treebank says is dominantly AUX (or any non-VERB class) is
        // ineligible; a form ABSENT from the prior stays eligible, the same
        // absent-is-a-gap-not-a-mismatch polarity that gate already holds.
        meta: { polarity: rel.polarity, source: encounter.source, encounterRef, compositionStanding: relationStanding(rel.label ?? rel.verb, posPrior) },
        });
      });

      const seenReferents = currentReferents(encounter.material, cache.matcher);
      // A merge is TESTIMONY, not an inference: it arrives with the surface
      // that proved it. The folded referents are never deleted — the fold is
      // upsert-only and cursor scrubbing depends on replaying the past — they
      // are MARKED, by this entry, as folded into the kept one.
      const mergeEntries = [];
      const witnessedMerges = (cache.merges ?? []).map((m) => ({ ...m, basis: m.basis ?? "name-variant coreference — a witnessed merge, recorded where it was decided" }));
      for (const m of witnessedMerges) {
        const key = `${m.kept}|${[...(m.folded ?? [])].sort().join("+")}`;
        if (emittedMerges.has(key) || !m.kept || !(m.folded ?? []).length) continue;
        emittedMerges.add(key);
        // A5 (THE-ADDRESS.md): a merge is an ACT over two birth-named beings —
        // its id hashes the act (kept + folded + the surface that witnessed
        // it) under the recipe this reading performed. Same merge dedups; two
        // instruments read two recipes and are two acts.
        const mergeContent = `merge|kept:${m.kept}|folded:${[...(m.folded ?? [])].sort().join("+")}|wit:${m.witness ?? ""}|recipe:${recipe ?? ""}`;
        mergeEntries.push(Object.freeze({
          schema: "EOReferentMerge@1",
          id: newId(mergeContent),
          kept: m.kept,
          folded: Object.freeze([...(m.folded ?? [])]),
          witness: m.witness ?? null,
          encounterRef: `encounter:${sequencePosition}`,
          provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: m.basis },
        }));
      }
      for (const r of cache.reassignments ?? []) {
        const key = `${r.from}|${r.to}|${r.surface}`;
        if (emittedMerges.has(`reassignment:${key}`) || !r.from || !r.to || r.from === r.to) continue;
        emittedMerges.add(`reassignment:${key}`);
        // A5 (THE-ADDRESS.md): a reassignment is an ACT over two birth-named
        // beings — its id hashes the act (from + to + the surface that
        // witnessed it) under the recipe this reading performed.
        const reassignmentContent = `reassignment|from:${r.from}|to:${r.to}|surface:${r.surface ?? ""}|recipe:${recipe ?? ""}`;
        mergeEntries.push(Object.freeze({
          schema: "EOReferentReassignment@1",
          id: newId(reassignmentContent),
          from: r.from,
          to: r.to,
          surface: r.surface ?? null,
          encounterRef: `encounter:${sequencePosition}`,
          provenance: { giver: "surfaces/discoverReferents", tier: "engine", basis: r.basis },
        }));
      }
      const mentions = seenReferents.map((ref) => {
        // A4 (THE-ADDRESS.md): a mention is a content occurrence — the being
        // (birth-named) as it appeared in this source's encounter. The id
        // hashes that content (source + encounter + referent), so the same
        // being read again in the same place dedups and nothing else collides.
        const mentionContent = `mention|src:${sourceScope}|enc:${encounterRef}|ref:${ref.id}`;
        return Object.freeze({
          schema: "EOMention@1",
          id: newId(mentionContent),
          referent: ref.id,
          encounterRef,
          anchor: encounter.anchor,
          witness: newId(`${mentionContent}|wit`),
          source: encounter.source,
        });
      });
      const lexicalOccurrences = lexicalNounOccurrences(encounter.material, sequencePosition, encounterRef, posPrior, sourceScope);
      const lexicalKeys = new Set(lexicalOccurrences.map((occ) => occ.surfaceKey));
      const targetedOccurrences = taskTargetOccurrences(encounter.material, sequencePosition, encounterRef, orientation, lexicalKeys, sourceScope);
      const activeIds = new Set(seenReferents.map((ref) => ref.id));
      for (const edge of edges) for (const participant of edge.participants ?? []) if (participant.standing === "referent") activeIds.add(participant.ref);
      const gaps = cache.gaps
        .filter((gap) => activeIds.has(gap.referent))
        .map((gap) => ({ schema: "EOReferentGap@1", id: `gap:referent:${slug(gap.referent)}`, ...gap }));

      const currentSentence = { text: encounter.material, offset: encounter.anchor?.start ?? 0, order: priorSentences.length };

      // Descriptor anchoring runs on EVERY sentence when enabled — the
      // activation frames must accumulate causally whether or not this
      // sentence carries a descriptor — and its evidence rides the
      // candidate's graphEntries so it passes through witness like every
      // other observation (nomination is not admission).
      let anchorEvidence = [];
      let descriptorOccsEmitted = [];
      if (anchoring) {
        // Only descriptors whose HEAD token survives two cuts are offered
        // for anchoring. Measured on Frankenstein's opening letters:
        // without them, "the most" / "that the" / "the first" —
        // determiner-plus-function/adjective bigrams, not descriptions of
        // any being — bound confidently to the only cast member in reach
        // and flooded the alternatives with furniture. Cut 1: the
        // perceiver's OWN frequency-derived closed class (cache.closed) —
        // never a hand list. Cut 2: when a POSPrior@1 is supplied (the
        // same received prior lexicalNounOccurrences already reads), a
        // head the treebank POSITIVELY says is not a noun ("most": ADV/ADJ
        // only; "first": ADJ-dominant) is refused; a head ABSENT from the
        // prior is kept — an unknown word cannot be proven furniture, and
        // furniture is by nature high-frequency and therefore present
        // (the same absent-is-a-gap-not-a-mismatch polarity
        // grammar-lens.js records for the identical prior).
        // Edge participants first: an anchored descriptor is only worth
        // something to composition if it resolves an endpoint an EDGE
        // actually has. These carry their participant's own occurrence id
        // so the binding lands in the id space the ledger reads.
        const participantOccs = edges.flatMap((edge) => (edge.participants ?? [])
          .filter((p) => p.standing === "unresolved_surface")
          .map((p) => {
            const occ = descriptorOccurrence(p, { encounterRef, edge });
            return occ ? { ...occ, participantOccurrence: p.occurrence ?? p.ref } : null;
          })
          .filter(Boolean));
        const descriptorOccs = [...participantOccs, ...directDescriptorOccurrences(encounter.material, { encounterRef })].filter((occ) => {
          const head = (occ.canonicalSurface ?? "").split(/\s+/).at(-1);
          if (!head || cache.closed.has(head)) return false;
          const counts = posPrior?.forms?.[diaNorm(head)];
          if (!counts) return true;
          const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
          const nounShare = total ? ((counts.NOUN ?? 0) + (counts.PROPN ?? 0)) / total : 0;
          return nounShare > GRAMMAR_MIN_SHARE;
        });
        anchorEvidence = anchoring.observe(currentSentence, descriptorOccs, cache.referents).evidence;
        // The occurrences themselves are perceptions too — emitted so a
        // downstream organ (descriptorBeings) can count recurrence of the
        // ones anchoring could NOT bind, instead of re-deriving the stream.
        descriptorOccsEmitted = descriptorOccs;
      }

      priorSentences.push(currentSentence);
      priorText += `${priorText ? "\n" : ""}${encounter.material}`;

      if (edges.length === 0 && seenReferents.length === 0 && lexicalOccurrences.length === 0 && targetedOccurrences.length === 0 && anchorEvidence.length === 0 && descriptorOccsEmitted.length === 0) return [];
      return [{
        candidate: {
          ...(fragmentSeam ? { fragmentDisclosure: FRAGMENT_DISCLOSURE } : {}),
          distinctions: [
            ...seenReferents.map((ref) => ({ referent: ref.id, surfaces: ref.surfaces })),
            ...edges.map((edge) => ({ relation: edge.relation, participants: edge.participants })),
            ...lexicalOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, upos: occ.upos })),
            ...targetedOccurrences.map((occ) => ({ occurrence: occ.id, surfaceKey: occ.surfaceKey, taskNominated: true })),
          ],
          hyperedges: edges,
          graphEntries: [...cache.referents, ...seenReferents, ...mergeEntries, ...mentions, ...lexicalOccurrences, ...targetedOccurrences, ...gaps, ...anchorEvidence, ...descriptorOccsEmitted],
        },
        anchor: encounter.anchor,
        evidence: encounter.material,
        nominationCause: targetedOccurrences.length ? ["bottom_up_difference", "active_task"] : "bottom_up_difference",
      }];
    },
  });
}

export function textEncounters(text, { source = "text", offset = 0 } = {}) {
  return splitSentences(text).map((sentence) => ({
    schema: "Encounter@1",
    source,
    modality: "text",
    anchor: { start: offset + sentence.offset, end: offset + sentence.offset + sentence.text.length },
    extent: sentence.text.length,
    material: sentence.text,
    sequencePosition: sentence.order,
  }));
}
