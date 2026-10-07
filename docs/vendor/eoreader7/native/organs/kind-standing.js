/* Shizhen speaks:
 * “Its 
leaves are flat, narrow at the base, broad and lobed at the end. 
The young leaves can be eaten. Deer are fond of the plant. 
In autumn it bears small, yellow flowers. The fruit is as large 
as that of the /laxtago major, and contains minute seeds, 
hardly distinguishable; wherefore the ancients asserted that 
the plant had no seeds, and called it the male southernwood.”’”
 *
 * This file, `eoreader7/native/organs/kind-standing.js`, implements a hierarchical classification of medicinal plants as outlined by Li Shizhen's `Bencao Gangmu`.  While the  manual labor of this approach is a valuable tool for organizing and understanding the vast diversity of medicinal plants, the process must remain grounded in the principles of empirical observation and the inherent uncertainties of the human condition.
 *
 * — the engineering record below, kept whole —
 */
// kind-standing.js — what KIND of thing is this referent? Measured from the
// Handle: Shizhen — after Li Shizhen's Bencao Gangmu: one individual specimen placed into a ranked, classified kind. Amendment XVII.
// material's own company, never taught, and gated by a null that is licensed
// for the question actually being asked.
//
// WHY THIS EXISTS. Three cast defects found reading Dracula live all reduce
// to one absence: the reader could not tell what kind of thing a referent
// was, so `Castle Dracula` folded into `Count Dracula` on a shared final
// token. A fold gate needs a STANDING to consult, and nothing produced one.
//
// FEATURES: NOTHING NAMED, NOTHING TAUGHT. The only evidence is the token
// immediately before and immediately after each mention — Firth's company,
// which P31 already cites. No part of speech, no semantic label, no word
// list. Sentence start is its own token, so position is evidence too.
//
// COUNTS, NOT SETS. A presence/absence profile destroys the signal: "Van
// Helsing" genuinely has `before=to` (14x), swamped by `^`(78) and `dr`(63).
// Membership cannot express "mostly prepositions" vs "mostly subject
// position"; a count vector can. Measured: a PMI gate over presence sets was
// tried at three thresholds and did not separate anything.
//
// ── THE NULL, AND TWO THAT WERE REFUTED BEFORE THIS ONE ──────────────────
//
// A10: before spending a null, check the pair is licensed — a statistic
// insensitive to its perturbation fails invisibly. Three were measured here,
// and only the third answers the membership question:
//
//  (1) RANDOM SUBSETS OF THE SAME POPULATION (the engine's own basin null,
//      entity-kind-induction.js). Degenerate when the basin approaches the
//      population: a random 149-subset of 174 entities is nearly the observed
//      set, so it passed a "kind" containing 85% of everything. It concealed
//      a real kind, not merely a false one.
//
//  (2) REDEALING WHICH ENTITY EACH MENTION BELONGS TO. Sound for asking
//      whether STRUCTURE EXISTS at all — observed binding energy 0.2657
//      against a 200-draw maximum of 0.2009, censored above. But insensitive
//      to MEMBERSHIP: adding one outsider to a cohesive ten-member set barely
//      moves binding energy, so every candidate "passed", including Mina and
//      Van Helsing against a set of places. Right question, wrong grain.
//      It also runs BACKWARDS for raw similarity — redealing gives every
//      entity the corpus-average profile, so redealt entities are MORE alike
//      than real ones (null median 0.400, max 0.950). Real entities are
//      specialised, therefore less similar. Agglomerating on "observed
//      similarity beats the null" stalls at all-singletons for that reason.
//
//  (3) THE POPULATION ITSELF (what ships). Nothing is redealt. The question
//      "is X a member of kind K" is answered by asking whether X sits closer
//      to K's members than the rest of the material does. The comparison is
//      every other entity, measured, not simulated.
//
// VALIDATED BY ITS OWN CONTROLS, not asserted: 9 of 10 declared members of a
// place-kind recover as members; the tenth (Purfleet, p≈0.10) is genuinely
// marginal and is reported as such rather than rounded in. `Castle Dracula`
// reads MEMBER (rank 3/100); `Count Dracula` reads not-a-member (43/100);
// Van Helsing, Mina, Lucy and Renfield all correctly not-places.
//
// DISCLOSED, NOT SILENTLY ABSENT. A referent with few mentions has a thin
// profile and lands not-a-member for lack of evidence rather than for
// evidence of difference — `East Cliff` (61/100) is exactly that case, which
// is why the East/West Cliff conflation is NOT closed by this. A verdict of
// `unknown` below is that state, and a gate must treat it as "no standing",
// never as "different kind".
//
// PURE. Sentences and surfaces arrive as arguments; this module reads no
// engine of its own (the cast.js posture).

/** A referent's company, as a raw count vector over `before=`/`after=` tokens.
 *
 *  Indexed, not scanned (2026-09-28): the first cut walked every sentence's
 *  word list once PER SURFACE, and the recursive reader calls this on every
 *  reprojection over every sentence read so far with the whole recurring
 *  vocabulary as `surfaces` — profiled at 75% of a 200KB read and quadratic
 *  over a book (400KB of War and Peace: 419s). Each sentence's words are now
 *  indexed once by word, and a surface is looked up by its first word; the
 *  counts are identical (every start position where the surface's words
 *  match, overlaps included, in sentence order). */
export function contextVectors(sentences, surfaces, { clean } = {}) {
  // An EOCompanyIndex@1 (organs/company-index.js) answers from what it has
  // already read; its own cleaner was fixed at creation, so `clean` here is
  // the index's, never re-applied.
  if (sentences?.schema === "EOCompanyIndex@1" && typeof sentences.vectors === "function") return sentences.vectors(surfaces);
  const toks = clean ?? ((t) => t.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, ""));
  const vecs = new Map(surfaces.map((s) => [s, new Map()]));
  const parts = surfaces.map((s) => s.split(" "));
  const byFirst = new Map();
  parts.forEach((pw, k) => { if (!byFirst.has(pw[0])) byFirst.set(pw[0], []); byFirst.get(pw[0]).push(k); });
  for (const sent of sentences) {
    const words = String(sent.text ?? sent).split(/\s+/).map(toks);
    for (let i = 0; i < words.length; i++) {
      const ks = byFirst.get(words[i]); if (!ks) continue;
      for (const k of ks) {
        const pw = parts[k];
        if (i + pw.length > words.length) continue;
        let ok = true; for (let j = 1; j < pw.length; j++) if (words[i + j] !== pw[j]) { ok = false; break; }
        if (!ok) continue;
        const v = vecs.get(surfaces[k]);
        const before = i > 0 ? words[i - 1].toLowerCase() : "^";
        const after = i + pw.length < words.length ? words[i + pw.length].toLowerCase() : "$";
        v.set(`before=${before}`, (v.get(`before=${before}`) ?? 0) + 1);
        v.set(`after=${after}`, (v.get(`after=${after}`) ?? 0) + 1);
      }
    }
  }
  for (const [k, v] of [...vecs]) if (!v.size) vecs.delete(k);
  return vecs;
}

const dot = (a, b) => { let s = 0; for (const [k, v] of a) s += v * (b.get(k) ?? 0); return s; };
export const cosine = (a, b) => { const d = Math.sqrt(dot(a, a)) * Math.sqrt(dot(b, b)); return d ? dot(a, b) / d : 0; };

/** Mean similarity of `x` to a kind's members, always leaving `x` itself out. */
export function kindFit(x, members, vecs) {
  const vx = vecs.get(x);
  if (!vx) return null;
  const ms = members.filter((k) => k !== x && vecs.has(k));
  if (!ms.length) return null;
  return ms.reduce((a, k) => a + cosine(vx, vecs.get(k)), 0) / ms.length;
}

/**
 * Is `x` a member of the kind `members` name? The null is the POPULATION —
 * every entity that is not a declared member — and `alpha` is the caller's,
 * never defaulted here (P4: numbers are declared).
 *
 * Returns a typed verdict, never a bare boolean: `unknown` when `x` has no
 * profile at all, which a gate must not read as "a different kind".
 */
export function kindMembership(x, members, vecs, { alpha }) {
  if (!Number.isFinite(alpha)) throw new Error("kindMembership: alpha must be declared");
  const fit = kindFit(x, members, vecs);
  if (fit === null) return { verdict: "unknown", reason: "no_profile", fit: null, p: null };
  const population = [...vecs.keys()].filter((y) => !members.includes(y));
  const nulls = population.map((y) => kindFit(y, members, vecs)).filter((v) => v !== null);
  if (nulls.length < 2) return { verdict: "unknown", reason: "no_population", fit, p: null };
  const above = nulls.filter((v) => v >= fit).length;
  const p = above / nulls.length;
  return { verdict: p < alpha ? "member" : "not_member", fit, p, populationSize: nulls.length };
}

/**
 * May these two referents be folded into one? A fold is REFUSED only on
 * positive evidence that the two carry DIFFERENT standings — never on
 * absence. `unknown` on either side yields `allow`, because a thin profile
 * is a fact about the reader, not about the referents.
 */
export function foldPermitted(a, b, members, vecs, { alpha }) {
  const ma = kindMembership(a, members, vecs, { alpha });
  const mb = kindMembership(b, members, vecs, { alpha });
  if (ma.verdict === "unknown" || mb.verdict === "unknown") return { permitted: true, reason: "no_standing", a: ma, b: mb };
  if (ma.verdict !== mb.verdict) return { permitted: false, reason: "different_kind", a: ma, b: mb };
  return { permitted: true, reason: "same_kind", a: ma, b: mb };
}

// ── discovered company-kinds: the kind names itself by its own signature ──
//
// User direction (2026-09-01, near-verbatim): "that there are words that
// sometimes have 'a' in front of it shouldn't be a hard written rule, it
// should be a discovered kind, and that kind can be addressable, and we can
// have a name for it in the hyperlexicon." This is the same question the
// module already answers for referents, one grain down: what kind of thing
// is this WORD, from the company it keeps — taught nothing, named by the
// material's own evidence.
//
// Measured on the real War and Peace HEARD stream (case- and diacritic-
// folded — the ear has no case) before this was built: general/count/
// emperor/colonel/captain all announce `before=the` as their dominant
// company (17–46% of it); kutuzov/napoleon/pierre/rostov/denisov all
// announce `before=^` with determiners absent; kutuzov~napoleon cosine
// 0.949 vs general~kutuzov 0.214. The kinds are real and the signature IS
// the name: `kind:before=the`, `kind:before=^`. One candidate signal was
// measured and REFUSED the same hour: cross-kind precedence ("titles front
// many different names") reads 0.6% at any practical sample of the name
// kind, because a title fronts hundreds of names — do not retry it as a
// gate.
//
// The structural distinction a consumer may lean on WITHOUT a word list: a
// kind signed by a WORD (members share an actual preceding word) is a
// frame-kind; a kind signed by POSITION alone (`^` — the absence of a
// preceding word) is not. `^` is not a word of any language, so this is
// structure, not English.

/**
 * discoverCompanyKinds(sentences, vocabulary, {minMentions, minShare,
 * minMembers}) — group words by the dominant `before=` feature of their own
 * company, at a declared share floor, keeping only kinds with a declared
 * minimum of members. All three numbers are the caller's (P4). Returns
 * [{name, signature, share: Map(word -> dominant share), members}], kinds
 * named mechanically by their own signature. The II.23 control lives with
 * the tests: shuffling words within sentences (marginals kept, company
 * destroyed) must dissolve every kind at the same declared floors.
 */
export function discoverCompanyKinds(sentences, vocabulary, { minMentions, minShare, minMembers, clean, nullArm = null } = {}) {
  for (const [k, v] of Object.entries({ minMentions, minShare, minMembers }))
    if (!Number.isFinite(v)) throw new Error(`discoverCompanyKinds: ${k} must be declared`);
  // THE NULL ARM (II.23, added 2026-09-01 after turbulence refuted the bare
  // share floor). A share floor answers "does this word have a dominant
  // predecessor" — which is trivially YES on a small alphabet where some
  // symbol is already half of all tokens. Measured: quadrant events over
  // {q1,q2,q3,q4} with q2 at ~50% marginal frequency cleared minShare 0.4
  // BY CHANCE, and the within-phrase shuffle control survived — the
  // statistic did not resolve the claim, exactly the failure II.23 exists
  // to catch. Text/music/video never exposed it because their alphabets are
  // large and no symbol dominates.
  //
  // The null is the SAME perturbation as the control: shuffle each phrase's
  // own tokens (marginals kept exactly, company destroyed), redraw the
  // shares, and admit a kind only when its observed share beats the
  // (1 - alpha) quantile of that distribution. `nullArm` is optional so no
  // existing caller moves; a caller that omits it gets the bare floors and
  // OWES its own control, which is what every current caller already runs.
  if (nullArm) for (const k of ["draws", "seed", "alpha"])
    if (!Number.isFinite(nullArm[k])) throw new Error(`discoverCompanyKinds: nullArm.${k} must be declared`);
  // `clean` is contextVectors' own token hygiene, forwarded — its DEFAULT
  // strips non-letter edges, which is a TEXT prior (found live: a music
  // stream's "d5" cleaned to "d", so no vocabulary word ever matched and
  // the kinds were silently empty). A non-text caller declares its own
  // cleaner (identity, usually); the default stays for text callers.
  if (nullArm && sentences?.schema === "EOCompanyIndex@1") throw new TypeError("discoverCompanyKinds: the null arm shuffles sentences it is handed — hand it sentences, never an index");
  const vecs = contextVectors(sentences, vocabulary, { clean });
  const bySignature = new Map();
  for (const [word, v] of vecs) {
    let total = 0, best = null, bestN = 0;
    for (const [f, n] of v) {
      if (!f.startsWith("before=")) continue;
      total += n;
      if (n > bestN) { bestN = n; best = f; }
    }
    if (!best || total < minMentions) continue;
    const share = bestN / total;
    if (share < minShare) continue;
    if (!bySignature.has(best)) bySignature.set(best, []);
    bySignature.get(best).push({ word, share });
    // (the null ceiling is applied after it is computed, below)
  }
  // the null: shares a word can reach when company is destroyed
  let ceiling = null;
  if (nullArm) {
    let seed = nullArm.seed >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const perWord = new Map();
    for (let d = 0; d < nullArm.draws; d++) {
      const redealt = sentences.map((sent) => {
        const words = String(sent.text ?? sent).split(/\s+/);
        for (let i = words.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [words[i], words[j]] = [words[j], words[i]]; }
        return { text: words.join(" ") };
      });
      const nv = contextVectors(redealt, vocabulary, { clean });
      for (const [word, v] of nv) {
        let tot = 0, best = 0;
        for (const [f, n] of v) { if (!f.startsWith("before=")) continue; tot += n; if (n > best) best = n; }
        if (!tot) continue;
        if (!perWord.has(word)) perWord.set(word, []);
        perWord.get(word).push(best / tot);
      }
    }
    ceiling = new Map();
    for (const [word, shares] of perWord) {
      shares.sort((a, b) => a - b);
      const idx = Math.min(shares.length - 1, Math.ceil((1 - nullArm.alpha) * shares.length) - 1);
      ceiling.set(word, shares[Math.max(0, idx)]);
    }
  }

  const kinds = [];
  for (const [signature, members] of bySignature) {
    if (members.length < minMembers) continue;
    const kept = ceiling ? members.filter((m) => m.share > (ceiling.get(m.word) ?? 1)) : members;
    if (kept.length < minMembers) continue;
    kinds.push({
      name: `kind:${signature}`,
      signature,
      members: kept.map((m) => m.word),
      share: new Map(kept.map((m) => [m.word, m.share])),
      ...(ceiling ? { nullCeiling: new Map(kept.map((m) => [m.word, ceiling.get(m.word) ?? null])) } : {}),
    });
  }
  return kinds;
}

/**
 * kindNotes(kinds, {witness}) — project discovered kinds into the shape the
 * hyperlexicon's `hear` admits, one assertion per membership: subject the
 * word, verb "keeps-company", object the kind's own name, `because` the
 * measured share. The kind becomes ADDRESSABLE — assertionId("general",
 * "keeps-company", "kind:before=the") — so a future organ consults the note
 * instead of re-deriving the measurement.
 */
export function kindNotes(kinds, { witness, recipe = null } = {}) {
  if (!witness) throw new Error("kindNotes: witness (the source these kinds were discovered in) must be named");
  // THE INSTRUMENT, named beside the source (P68 recipe identity; the
  // shared-instrument failure measured in eval/omnimodal-pipeline.mjs).
  // A kind is DISCOVERED BY a decoder, so a consumer asking "did two
  // independent readings find this" needs to know which instrument read
  // each source: `<source>~<recipe>` is corroboration.js's own shape,
  // and an omitted recipe stays honestly undeclared rather than being
  // counted as a second instrument.
  const who = recipe ? `${witness}~${recipe}` : witness;
  const notes = [];
  for (const kind of kinds)
    for (const word of kind.members)
      notes.push({
        subject: word,
        verb: "keeps-company",
        object: kind.name,
        witness: who,
        because: `${kind.signature} carries ${(kind.share.get(word) * 100).toFixed(0)}% of its before-company in ${witness}`,
      });
  return notes;
}

/**
 * frameWords(kinds) — the structural consumption, stated once: members of
 * every kind whose signature is a WORD-frame (not `^`/`$`, which are
 * positions, not words). A consumer treating these as non-referent-picking
 * is consuming a discovered kind by its address, not re-writing a rule.
 */
export function frameWords(kinds) {
  const out = new Set();
  for (const kind of kinds) {
    const tok = kind.signature.slice("before=".length);
    if (tok === "^" || tok === "$") continue;
    for (const w of kind.members) out.add(w);
  }
  return out;
}
