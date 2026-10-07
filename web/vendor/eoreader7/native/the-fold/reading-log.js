// reading-log.js — the holograph's address book as a PROJECTION OF THE
// READING'S OWN LOG, never a second reading. THE-HOLOGRAPH.md §7 names the
// law: the constitutional reader (READING-SPEC S1) writes `Encounter@1` (a
// sentence with its absolute byte anchor and its modality), `EOMention@1`
// (this mention → that referent, at this encounter), and `EOReferent@1`
// (the being: its surfaces and provenance, admitted under the Born gate,
// its address given at birth — S80). Everything here is a fold over those
// entries. No text is scanned, no case is read, no regex names a being:
// what the reader established is what exists (P38), in whatever script or
// medium the adapter that wrote the entries reads (S6, S16, S34–S39).
//
//   readingIndexFromLog(entries, organs)  → { referents, resolve, represent,
//       resolveIn, vocabulary, mentions } — the identity face the loops and
//       blocks resolve through. `resolve(name)` matches a name against the
//       referents' OWN surfaces under the session's fold (diaNorm) and the
//       coreference organ (namesCorefer) — the same two organs cast.js
//       resolves with; `resolveIn(text)` does it for every token run of a
//       text with no case anywhere (a Hebrew question and an English one go
//       through the same line); `vocabulary` is every token the reader
//       encountered, the material's own, for the absence bar.
//   `descriptors` (opt-in, both faces): { referentFrom, naming, key } — the
//       text adapter's projection of a recurring definite/possessive
//       descriptor into a PROVISIONAL referent (adapters/text/descriptor-lane.js
//       assembles all three), its head gate, and its standing test (the head
//       said here significantly more than a received corpus says it). Case is one witness
//       of a being, never the gate on whether the index may hold one; see
//       the lowercase lane in foldReading.
//   mentionBookFromLog(entries)           → the address book activation
//       retrieval reads: one row per encounter that carries a mention, its
//       referent ids, its absolute range; byId: referent → rows.
//   stepChunks(reader, chunks, …)         → feeds a run of chunks to the
//       constitutional reader as encounters (the adapter's own
//       `textEncounters`, offset = the chunk's absolute start), under a
//       declared budget, and hands back the log entries that landed so a
//       caller can persist them append-only (S25).
//
// Pure. The reader, the encounter adapter, diaNorm and namesCorefer are
// injected (the cast.js posture). Nothing here waits on the relation reader.
//
// VENDORED COPY, NOT A LINK — copied verbatim from the-fold/reading-log.js
// into eoreader7/native/the-fold/. It imports only ./source.js (also vendored
// here, independent). Carries the same FUTURE note as source.js: when the
// dependency flips to the-fold → eoreader7, this is one of the copies the
// upstream repo imports from its home here.
import { tokenize } from "./source.js";

const isEncounter = (e) => e?.schema === "Encounter@1";
const isMention = (e) => e?.schema === "EOMention@1";
const isReferent = (e) => e?.schema === "EOReferent@1";
const isOccurrence = (e) => e?.schema === "EOReferentOccurrence@1";
const isMerge = (e) => e?.schema === "EOReferentMerge@1";
const isReassignment = (e) => e?.schema === "EOReferentReassignment@1";
const isHypothesis = (e) => e?.schema === "EOIdentityHypothesis@1";

// foldReading is a union-find plus a coreference containment pass over every
// referent's surfaces (up to 3 passes) — the expensive step. A turn asks for
// both faces of it (readingIndexFromLog for identity, mentionBookFromLog for
// addresses) over the SAME entries array, and re-running the fold for the
// second face measured 2026-09-08: on a persisted 44,591-entry reading, two
// folds cost 38 s and 835,340 namesCorefer calls apiece. `entries` arrays are
// treated as immutable snapshots throughout this codebase (a growing log is
// concat'd into a NEW array, never mutated in place — conversation.mjs), so a
// WeakMap keyed on the array identity is exact: it never serves a stale fold
// for a log that has since grown, because growth always produces a new array.
const FOLD_MEMO = new WeakMap(); // entries array -> { lane, out }: its foldReading(...) result for one fixed set of organs
function foldReadingOnce(entries, organs) {
  if (!Array.isArray(entries)) return foldReading(entries, organs);
  // The descriptor lane is part of what was folded: a caller that asks
  // without it must not be served the fold that promoted descriptors, nor
  // the reverse (the same entries array, two faces, one lane).
  const lane = organs?.descriptors ?? null;
  const hit = FOLD_MEMO.get(entries);
  if (hit && hit.lane === lane) return hit.out;
  const out = foldReading(entries, organs);
  FOLD_MEMO.set(entries, { lane, out });
  return out;
}

/**
 * Fold the log once: referents by id (surfaces unioned), encounters in
 * order, mentions per encounter. The reading's entries live in the FOLD —
 * each step's `Observation@1` carries `graphEntries`, and `EOReferent@1` /
 * `EOMention@1` land there at the perceiver's refresh — so the fold is
 * reconstructed from the log by the kernel's own `reconstruct` (injected;
 * `kernel/fold.js`) and its `graphEntries` are read beside the log's
 * top-level `Encounter@1` rows. A material shorter than the refresh cadence
 * has no referents yet: that is the reader's own state, reported as such.
 */
export function foldReading(entries = [], { reconstruct = null, diaNorm = null, namesCorefer = null, surfaceIndex = null, surfacesIn = null, descriptors = null } = {}) {
  const referents = new Map(); const encounters = new Map(); const mentions = []; const occurrences = []; const reassignments = []; const hypotheses = [];
  let order = 0;
  let graph = [];
  if (typeof reconstruct === "function") { try { graph = reconstruct(entries)?.graphEntries ?? []; } catch { graph = []; } }
  else for (const e of entries ?? []) if (e?.schema === "Observation@1") graph.push(...(e.graphEntries ?? []));
  const merges = [];
  for (const e of [...(entries ?? []), ...graph]) {
    if (isMerge(e)) { merges.push(e); continue; }
    if (isReassignment(e)) { reassignments.push(e); continue; }
    if (isReferent(e)) {
      const r = referents.get(e.id) ?? { id: e.id, surfaces: new Set(), provenance: [], fedBy: new Set() };
      for (const s of e.surfaces ?? []) r.surfaces.add(String(s));
      // provenance is an ARRAY on the perceiver's admitted EOReferent@1 and an
      // OBJECT (a single {giver, basis} testimony, eoreader7's discourse-
      // referent organ) on recycled occurrence-level referents — the record
      // keeps both shapes; it never assumes the array form.
      const prov = e.provenance;
      if (Array.isArray(prov)) for (const p of prov) r.provenance.push(p);
      else if (prov && typeof prov === "object") r.provenance.push(prov);
      for (const f of e.fedBy ?? []) r.fedBy.add(String(f));
      referents.set(e.id, r);
    } else if (isEncounter(e)) {
      const key = encounterKey(e);
      if (!encounters.has(key)) encounters.set(key, { key, source: e.source, modality: e.modality ?? null, start: Number(e.anchor?.start), end: Number(e.anchor?.end), text: String(e.material ?? ""), sequencePosition: e.sequencePosition ?? null, order: order++, ids: new Set() });
    } else if (isMention(e)) mentions.push(e);
    else if (isOccurrence(e)) occurrences.push(e);
    else if (isHypothesis(e)) hypotheses.push(e);
  }
  // ONE BEING, MANY ADDRESSES. A reader that gives an address at birth
  // (S80) and clusters by evidence order (S17) leaves the fragments it
  // later folded on the log as separate ids: on Crime and Punishment,
  // «Pyotr», «Pyotr Petrovitch» and «Mr Luzhin» were three, and the reader
  // RECORDED folding them (EOReferentMerge@1, kept/folded, with the fuller
  // surface as witness). The projection applies exactly the reader's own
  // evidence, in two tiers, and never a rule of its own: (1) every recorded
  // merge, transitively; (2) a fragment whose LONGEST surface the reader's
  // own coreference organ (`namesCorefer`) places inside a fuller surface of
  // exactly ONE other being joins it — «Luzhin» inside «Mr Luzhin»,
  // «Raskolnikov» inside «Rodion Romanovitch Raskolnikov» — while a form
  // inside two beings' surfaces («Petrovitch», Luzhin's AND Porfiry's) is
  // S17's ambiguous bare form and stays its own, counted. The fuller side
  // never absorbs on its own; only the partial side joins. A being's face
  // is the member with the most surfaces; `members` keeps every address.
  const parent = new Map([...referents.keys()].map((id) => [id, id]));
  const find = (id) => { let x = id; while (parent.get(x) !== x) x = parent.get(x); let y = id; while (parent.get(y) !== x) { const n = parent.get(y); parent.set(y, x); y = n; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra === rb) return false; parent.set(rb, ra); return true; };
  let mergedByRecord = 0, mergedByContainment = 0, ambiguousForms = 0;
  for (const m of merges) { if (!referents.has(m.kept)) continue; for (const f of m.folded ?? []) if (referents.has(f) && union(m.kept, f)) mergedByRecord += 1; }
  const tokensOf = (t) => String(t ?? "").trim().split(/\s+/).filter(Boolean).length;
  const longestOf = (r) => { let best = ""; for (const sf of r.surfaces) if (tokensOf(sf) > tokensOf(best) || (tokensOf(sf) === tokensOf(best) && sf.length > best.length)) best = sf; return best; };
  if (typeof namesCorefer === "function") for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (const r of referents.values()) {
      const L = longestOf(r); if (!L) continue;
      const mine = find(r.id); const hosts = new Set();
      for (const o of referents.values()) { const oc = find(o.id); if (oc === mine || hosts.has(oc)) continue; for (const sf of o.surfaces) { if (tokensOf(sf) <= tokensOf(L)) continue; let co = false; try { co = namesCorefer(String(L), String(sf)) || namesCorefer(String(sf), String(L)); } catch { co = false; } if (co) { hosts.add(oc); break; } } }
      if (hosts.size === 1) { if (union([...hosts][0], r.id)) { mergedByContainment += 1; changed = true; } }
      else if (hosts.size > 1 && pass === 0) ambiguousForms += 1;
    }
    if (!changed) break;
  }
  const classes = new Map();
  for (const r of referents.values()) { const c = find(r.id); if (!classes.has(c)) classes.set(c, []); classes.get(c).push(r); }
  const canon = new Map(); const beings = new Map();
  for (const members of classes.values()) {
    const face = members.reduce((a, b) => (b.surfaces.size > a.surfaces.size ? b : a), members[0]);
    const being = { id: face.id, surfaces: new Set(), provenance: [], fedBy: new Set(), members: members.map((m) => m.id) };
    for (const m of members) { canon.set(m.id, face.id); for (const sf of m.surfaces) being.surfaces.add(sf); being.provenance.push(...m.provenance); for (const f of m.fedBy) being.fedBy.add(f); }
    beings.set(face.id, being);
  }
  const canonOf = (id) => canon.get(id) ?? id;
  referents.clear(); for (const [id, b] of beings) referents.set(id, b);
  // A mention names its encounter by ref (`encounterRef`) — match on the key the encounter itself carries, else on anchor + source.
  const byRef = new Map(); const bySeq = new Map();
  for (const enc of encounters.values()) { byRef.set(enc.key, enc); if (enc.sequencePosition != null) { byRef.set(`${enc.source}:${enc.sequencePosition}`, enc); bySeq.set(Number(enc.sequencePosition), enc); } }
  const encounterOf = (ref, anchor, source) => {
    const r = String(ref ?? "");
    return byRef.get(r) ?? (anchor ? byRef.get(`${source}#${anchor.start}-${anchor.end}`) : null) ?? (/:(\d+)$/.test(r) ? bySeq.get(Number(r.match(/:(\d+)$/)[1])) : null) ?? null;
  };
  // EOMention@1 is the reader's own occurrence-level answer (written for a referent already established at the step); it always attaches.
  for (const m of mentions) { const enc = encounterOf(m.encounterRef, m.anchor, m.source); if (enc && m.referent) enc.ids.add(canonOf(m.referent)); }
  // A being's birth records the mentions that FED it (P160's feeder links: `mention:<sequence>:<slug>`) — the sentences it stood in before it was born, which a causal read could not mention at the time. The reader's own record, read off.
  let fed = 0;
  for (const r of referents.values()) for (const f of r.fedBy) { const m = /^mention:(\d+):/.exec(f); if (!m) continue; const enc = bySeq.get(Number(m[1])); if (enc && !enc.ids.has(r.id)) { enc.ids.add(r.id); fed += 1; } }
  // EOReferentOccurrence@1 is every surface the reader saw, from the first sentence, before any refresh. It attaches at TYPE level only when its surface names exactly ONE referent — an ambiguous surface is the occurrence layer's question (S17-type, S11) and is counted as a gap, never guessed.
  // Resolution is the same two organs the index resolves with: the session's fold for an exact surface, then the coreference organ against each referent's own surfaces ("Rodion Raskolnikov" against "Raskolnikov").
  const foldKey = (t) => (typeof diaNorm === "function" ? diaNorm(String(t ?? "")) : String(t ?? "")).toLowerCase().replace(/\s+/g, " ").trim();
  // THE LOWERCASE LANE (opt-in: `descriptors = { referentFrom, naming }`).
  // The referents above are what the reader ADMITTED, and the admitting
  // pool is case-derived (capitalised surfaces) plus positional (heard). A
  // material whose beings are common nouns — "the pawl", "the cassette",
  // "the cyclist" — earns an EOIdentityHypothesis@1 from the reader (the
  // same descriptor recurring across distinct encounters) and nothing ever
  // lands in the index, so a question naming them resolves to nothing.
  // `referentFrom` is the text adapter's own projection of a hypothesis
  // (individuation.js::referentFromDescriptorHypothesis: definite or
  // possessive only — a repeated "a spring" is never one being), and it
  // stays PROVISIONAL and REVISABLE: case is one witness of a being here,
  // not the gate on whether the index may hold one.
  //   The lane is strictly additive and never overrides a name. A descriptor
  // is skipped when its head is a token of a being the name lanes already
  // hold ("the cumberland", "the river" beside «Cumberland River»: whether
  // those are one being is the coreference organs' question, not a second
  // being minted here) or when its surface is already registered; and when
  // `naming(head, cue)` is false — the received prior settles the head into a
  // class that cannot name a being ("the same"), or leaves it unattested
  // under a cue that is not itself settled ("that disengages"; the gate's
  // own two-reading rule, nominal-beings.js::namingGate). No case
  // is read; no word of any language is named here (the determiner class,
  // the closed classes and the prior are the injected adapter's).
  let descriptorBeings = 0, descriptorsSkipped = 0, descriptorLane = "off";
  if (descriptors && typeof descriptors.referentFrom === "function" && hypotheses.length) {
    const tokensOfKey = (t) => foldKey(t).split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
    // A lane with nothing to measure a head against abstains — typed, not
    // silent. Recurrence under a determiner is cheap; without a baseline
    // there is no standing to earn, and promoting on it alone admitted
    // "the time", "the thing", "her eyes" beside the real cast.
    if (typeof descriptors.key !== "function") descriptorLane = "no_baseline";
    else descriptorLane = "on";
    const headCount = new Map(); let words = 0;
    if (descriptorLane === "on") for (const enc of encounters.values()) for (const w of tokensOfKey(enc.text)) { words += 1; headCount.set(w, (headCount.get(w) ?? 0) + 1); }
    const nameTokens = new Set(); const registered = new Set();
    for (const r of referents.values()) for (const sf of r.surfaces) { registered.add(foldKey(sf)); for (const t of tokensOfKey(sf)) nameTokens.add(t); }
    for (const h of descriptorLane === "on" ? hypotheses : []) {
      let ref = null; try { ref = descriptors.referentFrom(h); } catch { ref = null; }
      if (!ref || referents.has(ref.id)) continue;
      const surface = String((ref.surfaces ?? [])[0] ?? ref.display ?? "");
      const toks = tokensOfKey(surface); const head = toks[toks.length - 1];
      if (!head || toks.length < 2) { descriptorsSkipped += 1; continue; }
      if (registered.has(foldKey(surface)) || nameTokens.has(head)) { descriptorsSkipped += 1; continue; }
      // A gate that THROWS refuses: a broken refusal must not read as no refusal.
      if (typeof descriptors.naming === "function") { let ok = false; try { ok = descriptors.naming(head, toks[0]) !== false; } catch { ok = false; } if (!ok) { descriptorsSkipped += 1; continue; } }
      let key = false; try { key = descriptors.key(head, headCount.get(head) ?? 0, words) === true; } catch { key = false; }
      if (!key) { descriptorsSkipped += 1; continue; }
      referents.set(ref.id, { id: ref.id, surfaces: new Set([surface]), provenance: ref.provenance ? [ref.provenance] : [], fedBy: new Set(), members: [ref.id], standing: ref.standing ?? "provisional", lane: "descriptor", occurrenceRefs: [...(ref.occurrenceRefs ?? [])] });
      registered.add(foldKey(surface)); descriptorBeings += 1;
    }
  }
  const surfaceIds = new Map();
  for (const r of referents.values()) for (const s of r.surfaces) { const k = foldKey(s); if (!surfaceIds.has(k)) surfaceIds.set(k, new Set()); surfaceIds.get(k).add(r.id); }
   // A reassignment changes which live address a surface resolves to; it does
   // not establish that the old and new beings are one. Keep the old referent
   // in the fold for historical addresses, but route fresh surface lookup to
   // the address the reader most recently assigned.
  for (const r of reassignments) {
    const k = foldKey(r.surface);
    if (!k || !referents.has(r.to)) continue;
    surfaceIds.set(k, new Set([r.to]));
  }
  const memo = new Map();
  const idsOfSurface = (surface) => {
    const k = foldKey(surface); if (!k) return new Set();
    if (memo.has(k)) return memo.get(k);
    let ids = surfaceIds.get(k);
    if ((!ids || !ids.size) && typeof namesCorefer === "function") { ids = new Set(); for (const r of referents.values()) for (const s of r.surfaces) { try { if (namesCorefer(String(surface), String(s))) { ids.add(r.id); break; } } catch {} } }
    ids = ids ?? new Set(); memo.set(k, ids); return ids;
  };
  let ambiguous = 0, unresolved = 0;
  for (const o of occurrences) {
    const enc = encounterOf(o.encounterRef, o.anchor, o.source); if (!enc) continue;
    let ids = idsOfSurface(o.surface ?? o.exactSurface); if (!ids.size && o.canonicalSurface) ids = idsOfSurface(o.canonicalSurface);
    if (!ids.size) { unresolved += 1; continue; }
    if (ids.size > 1) { ambiguous += 1; continue; }
    enc.ids.add([...ids][0]);
  }
  // The sentences a being stood in BEFORE its birth are in no log entry — a
  // causal reader cannot mention a being it has not yet established (S3),
  // and the log says so. The reader's own per-sentence surface matcher
  // (`surfaceIndex`/`surfacesIn`, recursive.js — the organ the perceiver
  // itself locates surfaces with; the session's fold, no case) is run over
  // the reader's own referent surfaces to locate them; an unambiguous
  // surface attaches, an ambiguous one is a counted gap. This is the
  // reader's organ over the reader's referents — a projection, not a scan
  // with a rule of its own.
  let located = 0;
  if (typeof surfaceIndex === "function" && typeof surfacesIn === "function" && referents.size) {
    const all = [...new Set([...referents.values()].flatMap((r) => [...r.surfaces]))];
    let sidx = null; try { sidx = surfaceIndex(all); } catch { sidx = null; }
    if (sidx) for (const enc of encounters.values()) {
      let present = []; try { present = surfacesIn(enc.text, sidx) ?? []; } catch { present = []; }
      for (const sf of present) { const ids = idsOfSurface(sf); if (ids.size === 1) { const id = [...ids][0]; if (!enc.ids.has(id)) { enc.ids.add(id); located += 1; } } else if (ids.size > 1) ambiguous += 1; }
    }
  }
  return { referents, encounters: [...encounters.values()].sort((a, b) => a.order - b.order), mentions, occurrences: occurrences.length, ambiguous, unresolved, fed, located, reassignments, identity: { beings: referents.size, fragments: canon.size, mergedByRecord, mergedByContainment, reassignments: reassignments.length, ambiguousForms, descriptorBeings, descriptorsSkipped, descriptorLane } };
}
const encounterKey = (e) => e?.anchor && Number.isFinite(Number(e.anchor.start)) ? `${e.source}#${e.anchor.start}-${e.anchor.end}` : `${e.source}:${e.sequencePosition}`;

/**
 * The identity face over the reading. `resolve(name)`: a referent whose own
 * surface equals the name under the fold, or corefers with it by the
 * injected organ; `resolveIn(text)`: every token run of `text` (up to the
 * longest surface, first token indexed) resolved the same way — no case.
 */
export function readingIndexFromLog(entries = [], { diaNorm, namesCorefer, reconstruct = null, surfaceIndex = null, surfacesIn = null, descriptors = null } = {}) {
  if (typeof diaNorm !== "function") throw new TypeError("readingIndexFromLog: diaNorm (the session's fold) is injected");
  const { referents, encounters, mentions, reassignments, identity } = foldReadingOnce(entries, { reconstruct, diaNorm, namesCorefer, surfaceIndex, surfacesIn, descriptors });
  const norm = (t) => diaNorm(String(t ?? "")).toLowerCase().trim();
  const bySurface = new Map(); const byFirst = new Map(); let longest = 1;
  for (const r of referents.values()) for (const s of r.surfaces) {
    const n = norm(s); if (!n) continue;
    if (!bySurface.has(n)) bySurface.set(n, new Set()); bySurface.get(n).add(r.id);
    const toks = n.split(/\s+/); longest = Math.max(longest, toks.length);
    if (!byFirst.has(toks[0])) byFirst.set(toks[0], new Set()); byFirst.get(toks[0]).add(r.id);
  }
  for (const r of reassignments) {
    const k = norm(r.surface);
    if (k && referents.has(r.to)) bySurface.set(k, new Set([r.to]));
  }
  // MAXIMAL MUNCH. A run of tokens resolves by its LONGEST registered
  // surface, and the tokens that surface consumed are not resolved again as
  // shorter surfaces: "Rodya Pyotr Petrovitch" is «Rodya» + «Pyotr
  // Petrovitch», never also «Petrovitch» — which is Porfiry Petrovitch's
  // patronymic too. Measured 2026-09-07 on Crime and Punishment: the
  // first cut resolved that run to SEVEN referents (Porfiry among them) and
  // the activation reached 459 sentences at hop 0 and 2,987 at hop 1 —
  // the window rode its ceiling. Coreference by the injected organ is the
  // LAST resort, only for a name no registered surface stands in, because
  // `namesCorefer` shares tokens across every referent and a shared
  // patronymic is exactly the token it shares.
  // A run also resolves when a registered surface is a PREFIX of it and what
  // remains does not begin with a letter. Measured on 277 real questions
  // against this book's own reading: without it, "Razumihin's" resolves to
  // nothing, because the tokenizer keeps the clitic inside the token and
  // `byFirst` never sees the name. NOTHING HERE KNOWS WHAT 's IS — the rule
  // consults \p{L} and the index's own registered forms, so it admits a
  // clitic, a case ending or an enclitic in any script for the same reason,
  // and refuses Anna/Annapolis for the same reason (the remainder there
  // begins with a letter). The alternative — stripping English possessives —
  // is the SAE-shaped rule P76 and S40 already refuse.
  const startsRegistered = (run) => {
    for (let k = run.length; k > 0; k--) {
      const head = run.slice(0, k);
      const hit = bySurface.get(head);
      if (!hit?.size) continue;
      const rest = run.slice(k);
      if (rest && /^\p{L}/u.test(rest)) continue;
      return hit;
    }
    return null;
  };
  const resolveIn = (text) => {
    const toks = norm(text).split(/[^\p{L}\p{N}'’-]+/u).filter(Boolean);
    const out = new Set();
    for (let i = 0; i < toks.length; i++) {
      for (let j = Math.min(toks.length, i + longest); j > i; j--) {
        const run = toks.slice(i, j).join(" ");
        const hit = bySurface.get(run) ?? startsRegistered(run);
        if (hit?.size) { for (const id of hit) out.add(id); i = j - 1; break; }
      }
    }
    return out;
  };
  // A name unresolved by an exact surface or a munch falls to a coreference
  // scan of every referent's every surface — the O(referents × surfaces) term
  // measured 2026-09-08: a turn asks `resolve` for the same note ends (ledger
  // subjects/objects, mostly unresolvable descriptors like "the old woman")
  // over and over across `activate`, `lensCut` and `paradigmBlock`, each ask
  // repeating the full scan. `resolve` is a pure function of this frozen
  // index's own referents, so memoizing by the raw name is exact for the
  // index's lifetime — never shared across a different reading.
  const resolveMemo = new Map();
  const resolve = (name) => {
    const key = String(name ?? "");
    const hit = resolveMemo.get(key); if (hit) return hit;
    const n = norm(name);
    let out;
    if (!n) out = new Set();
    else {
      const exact = bySurface.get(n);
      if (exact?.size) out = new Set(exact);
      else {
        const munched = resolveIn(n);
        if (munched.size) out = munched;
        else {
          out = new Set();
          if (typeof namesCorefer === "function") for (const r of referents.values()) for (const s of r.surfaces) { try { if (namesCorefer(String(name), String(s))) { out.add(r.id); break; } } catch {} }
        }
      }
    }
    resolveMemo.set(key, out);
    return out;
  };
  const represent = (id) => { const r = referents.get(id); if (!r) return id; let best = ""; for (const s of r.surfaces) if (s.length > best.length) best = s; return best || id; };
  const vocabulary = new Set(); for (const enc of encounters) for (const t of tokenize(enc.text)) vocabulary.add(t);
  // `events` is the face dialogue.js::surfacesOf reads (one row per registered surface, as the cast index keeps them), so the address check's re-ask hands the reader's own surfaces for a missing referent and not nothing.
  const events = []; for (const r of referents.values()) for (const sf of r.surfaces) events.push({ referent_id: r.id, surface: sf });
  return Object.freeze({ referents: new Set(referents.keys()), events, resolve, resolveIn, represent, vocabulary, mentions: mentions.length, encounters: encounters.length, caseless: true, descriptorBeings: identity?.descriptorBeings ?? 0, descriptorsSkipped: identity?.descriptorsSkipped ?? 0, descriptorLane: identity?.descriptorLane ?? "off", basis: "readingIndexFromLog: EOReferent@1 surfaces under the session's fold + namesCorefer; no case, no scan" });
}

/** The address book: one row per encounter carrying a mention, in reading order; byId: referent → rows. Same shape activation-retrieval.js reads. */
export function mentionBookFromLog(entries = [], { reconstruct = null, diaNorm = null, namesCorefer = null, surfaceIndex = null, surfacesIn = null, descriptors = null } = {}) {
  const f = foldReadingOnce(entries, { reconstruct, diaNorm, namesCorefer, surfaceIndex, surfacesIn, descriptors });
  const { encounters } = f;
  const sentences = []; const byId = new Map(); const gaps = [];
  for (const enc of encounters) {
    if (!enc.ids.size) continue;
    if (!Number.isFinite(enc.start) || !Number.isFinite(enc.end)) { gaps.push({ key: enc.key, reason: "encounter without an anchor" }); continue; }
    const row = { ref: `${enc.source}#${enc.start}-${enc.end}`, source: enc.source, start: enc.start, end: enc.end, text: enc.text, ids: enc.ids, order: sentences.length, modality: enc.modality };
    sentences.push(row);
    for (const id of enc.ids) { if (!byId.has(id)) byId.set(id, []); byId.get(id).push(row.order); }
  }
  return { sentences, byId, gaps, referents: byId.size, located: f.located, ambiguous: f.ambiguous, basis: "mentionBookFromLog: EOMention@1 + the referent's feeders + the reader's own surface matcher over its referents' surfaces, over Encounter@1 anchors" };
}

/**
 * stepChunks(reader, chunks, { textEncounters, cursor, budgetMs }) → { cursor, read, entries, ms }
 * Feeds chunks[cursor…] to the reader as encounters (source = the chunk's
 * own source name, offset = its absolute start, so every anchor is the
 * file's own address) until the budget is spent; returns the log entries
 * that landed since `reader.getLog().length` was `logLength` — the caller
 * persists them append-only. A budget of 0 reads everything handed.
 */
export async function stepChunks(reader, chunks = [], { textEncounters, cursor = 0, budgetMs = 0, logLength = null, sequence = null } = {}) {
  if (!reader?.step || typeof textEncounters !== "function") throw new TypeError("stepChunks: a reader with step() and the adapter's textEncounters are injected");
  const t0 = Date.now(); let i = cursor; const before = logLength ?? reader.getLog().length;
  // The reader's encounter identity is its SEQUENCE POSITION, and textEncounters numbers a text from 0 — feeding chunk by chunk without a running count gives every chunk's first sentence the same position and the reader's own mention references collide across chunks (found 2026-09-07). The count runs across the whole material, as it does when the reference driver feeds the text in one call.
  let seq = sequence ?? (reader.getLog().filter((e) => e?.schema === "Encounter@1").length);
  while (i < chunks.length && (!budgetMs || Date.now() - t0 < budgetMs)) {
    const c = chunks[i];
    const source = c.source ?? String(c.ref ?? "").split("#")[0];
    for (const e of textEncounters(String(c.text ?? ""), { source, offset: Number(c.start) || 0 })) await reader.step({ ...e, sequencePosition: seq++ });
    i += 1;
  }
  const log = reader.getLog();
  return { cursor: i, read: i - cursor, entries: log.slice(before), logLength: log.length, sequence: seq, ms: Date.now() - t0 };
}
