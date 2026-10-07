// essay-fold.js — THE FOLD, THE VALUATION PHASE OF THE CONCRESCENCE (2026-09-21).
//
// The mouth writes WIDE — whatever the void def'd, capped only against runaway
// (twelve sections, not five). The FOLD then assembles the wide draft into the
// asked-for shape. This is not a truncation: it is the piece deciding its
// character. Each distinct claim goes to ONE beat of the shape, by its referent
// signature; duplicates collapse (the longest/grounded variant survives, the
// loser is KEPT in `refused` with its given — never vanished); beats that end
// up thin are named `gap`, never silently empty.
//
// THE WATCHMAKER RULE (2026-09-21, the user's law: "each level should give us
// something useable even if not fully satisfactory"): the fold returns the
// beats array EVEN when some beats are thin or the prose is rough. The shape
// exists; the gaps are named; the refusals are attributed. A run killed at the
// fold boundary holds a usable outline, not a half-essay.
//
// PURE. The fold is a function of { wideParts, beats, ground, claimCoreOf }.
// The same wide draft over the same shape folds identically every time.

// ── the stable claim-core — the mechanical identity of a sentence's claim ──
// The same set the composition's registry uses: being-nouns and change-verbs
// with variance words stripped, so "played a significant role in Nashville's
// growth" and "served as a vital artery for Nashville's growth" are the SAME
// claim. Declared here so the fold is self-contained (the composition's copy
// lives in proxy-runner.mjs; either is authoritative — the fold keys on cores
// the registry produced).
const FOLD_CLAIM_VARIANTS = new Set(["played","served","significant","vital","crucial","critical","major","role","growth","port","city","artery","impact","influence","development","journey","course","waterway","river","cumberland","nashville"]);
const FOLD_STOP = new Set(["the","a","an","and","or","but","of","in","on","at","for","to","from","by","with","into","onto","it","its","is","was","are","were","be","been","this","that","these","those","as","while","which","who","whose","has","have","had","not","no","so","too","very","also","their","there","here","about","after","before","between","through","during","without","within","along","over","under","because","though","although","however","then","now","first","second","third","last","one","two","many","much","some","few","other","another","more","most"]);
// NUMBER WORDS — a lookup table, not a regex: "18,000" and "eighteen thousand"
// normalize to the same token so two sentences asserting the same drainage
// claim collapse to one core. A regex alternation would be a table wearing
// regex clothes — a Set is the honest form.
const FOLD_NUMBER_WORDS = new Set(["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety","hundred","thousand","million","billion"]);
// HEDGE WORDS — dropped from the core: "roughly", "about", "nearly" are the
// mouth's estimation, not the claim. Two sentences that differ only in their
// hedge are the same claim.
const FOLD_HEDGES = new Set(["roughly","about","nearly","approximately","around","some"]);
// MEASURE WORDS — a number followed by a measure ("square miles", "688 miles",
// "18,000 square miles") is the claim's QUANTIFIABLE OBJECT. The measure noun
// normalizes to a single token so "18,000 square miles" and "eighteen thousand
// square miles of the interior South" are the same size, whatever the surface.
const FOLD_MEASURES = new Set(["mile","miles","square","kilometer","kilometers","acre","acres","hectare","hectares","foot","feet","meter","meters","gallon","gallons","ton","tons"]);
// VERBS — the claim's ACTION. The core is verb-anchored: the identity of a
// claim is its verb + its object, not the whole sentence bag. Two sentences
// that share verb + measure are the same claim even when their modifiers
// differ ("drains a basin of N square miles across the plateau" vs "drains N
// square miles of the interior South" — both assert the drainage).
const FOLD_VERBS = new Set(["drains","flows","joins","named","founded","arrived","made","shaped","used","built","remained","connected","provided","supported","caused","traveled","played","served","became","grew","handles","carries","provides","supplies","reaches","begins","ends","spans","covers","forms","occupies","cuts","routes","connects","links","carried","settled","traded","traveled","established","created","controlled","developed","managed"]);
// HOLLOW-ACTOR VERBS — the mouth's filler where a grounded name is stuck onto
// a verb that predicts or requests instead of asserting a grounded fact.
// "Bob expects the river to play a role" is not a fact; it is the mouth
// improvising a witness. A Set, matched by token membership, never a regex
// (KleeneUp's doctrine). The detection is: does the sentence attach one of
// these verbs to a PERSON subject? The Set is the vocabulary; the walk checks
// the shape.
const HOLLOW_ACTOR_VERBS = new Set(["expects","expected","hopes","hoped","believes","believed","thinks","thought","wants","wanted","wishes","wished","predicts","predicted","asks","asked","requests","requested","desires","desired","foresees","envisions","anticipates","implies","suggests","notes","notes that","mentions","states"]);
function hasHollowActor(s) {
  const t = String(s ?? "").toLowerCase();
  return [...HOLLOW_ACTOR_VERBS].some((v) => t.includes(v));
}
export function foldClaimCore(s) {
  const tokens = String(s).toLowerCase()
    .split(/[^a-z']+/)                            // non-letters (spaces, digits, punctuation) → breaks
    .map((w) => FOLD_NUMBER_WORDS.has(w) ? "num" : w)
    .filter((w) => w && w !== "num" && !FOLD_STOP.has(w) && !FOLD_HEDGES.has(w) && !FOLD_CLAIM_VARIANTS.has(w));
  // VERB-ANCHORED IDENTITY (2026-09-21, F2's failure): the claim is its action
  // + its quantifiable object. When the verb's object is a MEASURE ("drains
  // 18,000 square miles", "flows 688 miles"), the core is verb + the measure
  // phrase — container nouns ("basin", "area") and location modifiers ("across
  // the plateau", "of the interior South") do NOT define the claim. Two
  // sentences that both assert "the river drains N square miles" collapse
  // regardless of their modifiers. Without a measure, the core is verb + the
  // following significant words.
  const vi = tokens.findIndex((w) => FOLD_VERBS.has(w));
  const measureIdx = tokens.findIndex((w) => FOLD_MEASURES.has(w));
  if (vi >= 0) {
    if (measureIdx > vi) {
      // verb + the measure phrase (a measure word and any adjacent measure
      // word: "square miles", "688 miles" → "square miles", "miles").
      const core = [tokens[vi]];
      core.push(tokens[measureIdx]);
      if (tokens[measureIdx + 1] && FOLD_MEASURES.has(tokens[measureIdx + 1])) core.push(tokens[measureIdx + 1]);
      return core.join(" ");
    }
    const after = tokens.slice(vi);
    return after.slice(0, 4).join(" ");
  }
  return tokens.slice(0, 6).join(" ");
}

// ── the referent signature of a sentence — the capitalized names it carries ─
// Reused from referent-verify's nameRuns (the SAME grammar that grounds the
// mouth): a sentence's beat is chosen by which referents it holds. The full
// admission gate (invented referents + meta) is re-run at the fold — the last
// mechanical door.
import { nameRuns, inventedNameRuns, isMetaSentence } from "./referent-verify.js";
// R (2026-09-26): an optional referents.js buildReferents(ground) resolver,
// duck-typed to {resolveText, represent}. Additive only — the existing
// name-run signature is never removed, only unioned with what the resolver
// can further resolve ("the river" -> "Cumberland River" when the ground
// makes that a real, measured majority). No resolver -> unchanged behavior.
function sentenceReferents(s, R = null) {
  const runs = nameRuns(s).map((r) => r.join(" ").toLowerCase());
  if (!R) return runs;
  let resolved = [];
  try {
    resolved = [...R.resolveText(s)].map((id) => String(R.represent(id) ?? "").toLowerCase()).filter(Boolean);
  } catch {
    resolved = [];
  }
  return [...new Set([...runs, ...resolved])];
}

// ── wide → atoms ────────────────────────────────────────────────────────────
// Every sentence across the wide draft, claim-cored and referent-tagged. The
// atoms are the prehensions the fold will value. Each carries its giver — the
// mouth (the model) is the given of everything in the wide draft; nothing is
// unattributed.
// SENTENCE SPLIT THAT RESPECTS ABBREVIATIONS (2026-09-21, F3's first failure):
// "Dr. Thomas Walker" split after "Dr." because the abbreviation's period is
// indistinguishable from a sentence end to a naive split. The token walk below
// uses the abbreviation table explicitly: a period ends a sentence ONLY when
// the last word is NOT an abbreviation AND the next token starts a capitalized
// word — no regex lookarounds.
const ABBREV = new Set(["dr","mr","mrs","ms","st","mt","us","usa","etc","eg","ie","vs","no","gen","gov","sen","rep","prof","sr","jr","phd","md","corps","co","inc","ltd"]);
const TERMINAL = new Set([".", "!", "?", "…"]);
function splitSentences(part) {
  const tokens = String(part).replace(/\s+/g, " ").trim().split(" ");
  const sentences = [];
  let cur = "";
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (!cur) { cur = tok; continue; }
    const prevWord = cur.split(" ").pop().toLowerCase().replace(/[^a-z.]/g, "");
    const prevBase = prevWord.endsWith(".") ? prevWord.slice(0, -1) : prevWord;
    const lastChar = cur.charAt(cur.length - 1);
    const isTerminal = TERMINAL.has(lastChar);
    const isAbbrev = ABBREV.has(prevWord) || ABBREV.has(prevBase) || /^\.[A-Z]/.test(tok);
    const nextCaps = /^[A-Z]/.test(tok);
    if (isTerminal && nextCaps && !isAbbrev) {
      sentences.push(cur.trim());
      cur = tok;
    } else {
      cur += " " + tok;
    }
  }
  if (cur.trim()) sentences.push(cur.trim());
  return sentences.filter((s) => s.length > 20);
}
export function wideToAtoms(wideParts = [], { ground = "", claimCoreOf = null, referents = null } = {}) {
  const core = claimCoreOf ?? foldClaimCore;
  const atoms = [];
  for (let p = 0; p < wideParts.length; p++) {
    const part = String(wideParts[p] ?? "").replace(/\s+/g, " ").trim();
    if (!part) continue;
    for (const s of splitSentences(part)) {
      atoms.push({ sentence: s, core: core(s), referents: sentenceReferents(s, referents), partIndex: p, giver: "model" });
    }
  }
  return atoms;
}

// ── the fold ────────────────────────────────────────────────────────────────
// beats: [{ title, charge, referents: [] }] — the asked shape. The DEFAULT is
// a generic five-beat essay shape (identity / origins / evidence / tension /
// return); a caller may pass the void's own cells as beats instead. Each
// distinct claim is assigned to the beat whose referent/word signature it best
// matches; duplicates collapse; beats with nothing named `gap`.
export function foldWideToShape(atoms = [], { beats = null, ground = "" } = {}) {
  const shape = beats && beats.length ? beats : DEFAULT_ESSAY_BEATS;
  // 0. RE-ADMISSION — THE FOLD IS THE LAST MECHANICAL DOOR (2026-09-21, the
  //    "get the essay done" pass). The section snip admitted sentences against
  //    the section's OWN moment of ground (smaller, earlier — a web page not
  //    yet landed, a name not yet established). The fold sees the WHOLE ground
  //    and re-runs the full admission: an invented referent ("Duke Energy" —
  //    the ground has the Duke of Cumberland, never Duke Energy) and a
  //    meta-sentence ("The Convention is a subject of discussion") that the
  //    section snip let through are REFUSED here, before anything becomes the
  //    essay. The refused sentence is KEPT with its given and reason, never
  //    vanished (§V). Every sentence that survives the fold is the essay.
  const admitted = [];
  const foldRefused = [];
  for (const a of atoms) {
    const names = inventedNameRuns(a.sentence, ground);
    const meta = isMetaSentence(a.sentence);
    if (names.length) { foldRefused.push({ ...a, reason: "fold_invented_referent", names: names.map((v) => v.name) }); continue; }
    if (meta) { foldRefused.push({ ...a, reason: "fold_meta" }); continue; }
    // THE HOLLOW-ACTOR CHECK (2026-09-21, the "Bob expects" failure): a
    // grounded name used as the subject of an EXPECTATION/REQUEST verb is the
    // mouth's filler — the source names Bob Duthie as a BOOK AUTHOR (a
    // bibliography line), never as someone who "expects the river to play a
    // role." The verb-table is a Set; the shape it guards (a person name +
    // expect/request/hope/believe) is walked, not matched.
    if (hasHollowActor(a.sentence)) { foldRefused.push({ ...a, reason: "hollow_actor" }); continue; }
    admitted.push(a);
  }
  const atoms2 = admitted;
  // 1. DEDUPE — each claim-core exactly once. The longest variant survives (the
  //    mouth's fullest statement of the fact); the loser is KEPT in `refused`
  //    with its given, never vanished (the constitution §V: the swarm keeps the
  //    losing readings).
  const byCore = new Map();
  const refused = [...foldRefused];
  for (const a of atoms2) {
    if (!a.core || a.core.length < 4) { refused.push({ ...a, reason: "core_too_thin" }); continue; }
    const cur = byCore.get(a.core);
    if (!cur) { byCore.set(a.core, a); continue; }
    if (a.sentence.length > cur.sentence.length) {
      refused.push({ ...cur, reason: "repeated_claim" });
      byCore.set(a.core, a);
    } else {
      refused.push({ ...a, reason: "repeated_claim" });
    }
  }
  // THE SAME CLAIM, TWICE, IN TWO BEATS (2026-09-21, read off a finished
  // fold): "Native American tribes, including the Cherokee, Chickasaw, and
  // Shawnee, utilized the Cumberland River for centuries" landed in one beat
  // and "Native American peoples including the Cherokee, Chickasaw, and
  // Shawnee used the Cumberland for trade, travel, and settlement" landed in
  // another. Their claim cores differ — the core reads a fixed number of
  // words and these diverge inside that window — so the core dedupe above
  // could not see it. What they share is their MATTER: the grounded words
  // they assert. A claim that brings no grounded word the fold has not
  // already placed is the same claim in other clothes, and it is refused with
  // its giver kept, exactly as a core repeat is.
  const ordered = [...byCore.values()].sort((x, y) => (x.partIndex ?? 0) - (y.partIndex ?? 0));
  const groundWords = new Set(String(ground ?? "").toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3 && !FOLD_STOP.has(w)));
  const placedMatter = new Set();
  const distinct = [];
  for (const a of ordered) {
    const matter = [...new Set(String(a.sentence).toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3 && !FOLD_STOP.has(w) && groundWords.has(w)))];
    // A claim with no grounded matter at all is judged by the core alone —
    // there is nothing here to compare, and only the beat assignment can
    // decide whether the shape has a place for it.
    if (matter.length && matter.every((w) => placedMatter.has(w))) {
      refused.push({ ...a, reason: "no_new_matter" });
      continue;
    }
    for (const w of matter) placedMatter.add(w);
    distinct.push(a);
  }
  // A LIGHT STEM (2026-09-21, the fold's first residual failure): "floods"
  // must match a beat charging "flood", "flows" must match "flow". The stem is
  // a Set of suffix rules (plural-s, -ing, -ed, -ly) applied to both sides —
  // never a regex alternation, a tiny explicit walk.
  const stemWord = (w) => {
    let s = String(w);
    if (s.length > 5 && s.endsWith("ies")) return s.slice(0, -3) + "y";
    if (s.length > 5 && s.endsWith("ing")) return s.slice(0, -3);
    if (s.length > 5 && s.endsWith("ed")) return s.slice(0, -2);
    if (s.length > 5 && s.endsWith("ly")) return s.slice(0, -2);
    if (s.length > 3 && s.endsWith("s") && !s.endsWith("ss") && !s.endsWith("us")) return s.slice(0, -1);
    return s;
  };
  // 2. BEAT SIGNATURE — the words and referents that define each beat.
  const beatWords = shape.map((b) => {
    const w = new Set(String(`${b.title ?? ""} ${b.charge ?? ""}`).toLowerCase().split(/[^a-z']+/).map(stemWord).filter((x) => x.length > 3));
    const refs = new Set((b.referents ?? []).map((r) => r.toLowerCase()));
    return { ...b, words: w, refs };
  });
  // 3. ASSIGN — each distinct claim to its best-matching beat. Score = shared
  //    content words + shared referents (double weight: a referent is a strong
  //    claim on the beat). A claim that matches NO beat's signature is NOT
  //    force-fitted to whichever beat has the fewest claims — it is named
  //    RESIDUAL (the shape cannot place it, and the fold says so instead of
  //    pretending the beat held it). The residual is the honest disclosure of
  //    a shape mismatch, exactly as `gap` is for an empty beat.
  const assignments = new Map(); // beatIndex -> [atoms]
  const residual = [];
  const wordsOf = (x) => new Set(String(x).toLowerCase().split(/[^a-z']+/).map(stemWord).filter((w) => w.length > 3 && !FOLD_STOP.has(w)));
  const score = (a, b) => {
    const words = wordsOf(a.sentence);
    let s = 0;
    for (const w of words) if (b.words.has(w)) s += 1;
    for (const r of a.referents) if (b.refs.has(r)) s += 2;
    return s;
  };
  for (const a of distinct) {
    let best = 0;
    let bestScore = -1;
    for (let b = 0; b < beatWords.length; b++) {
      const sc = score(a, beatWords[b]);
      if (sc > bestScore) { bestScore = sc; best = b; }
      else if (sc === bestScore && (assignments.get(b)?.length ?? 0) < (assignments.get(best)?.length ?? 0)) { best = b; }
    }
    if (bestScore <= 0) {
      // No beat's signature touches this claim — it does not belong to the
      // shape. Named, never hidden.
      residual.push(a);
      continue;
    }
    if (!assignments.has(best)) assignments.set(best, []);
    assignments.get(best).push(a);
  }
  // 4. BEATS — the assembled shape. A beat with nothing is named `gap` (never
  //    silently empty — the fold tells us what it could not gather). Order
  //    within a beat is the mouth's own order (the wide draft's sequence).
  const beatsOut = beatWords.map((b, i) => {
    const claims = (assignments.get(i) ?? []).sort((x, y) => x.partIndex - y.partIndex);
    return {
      title: b.title,
      sentences: claims.map((c) => c.sentence),
      text: claims.map((c) => c.sentence).join(" "),
      gap: claims.length === 0,
      claimCount: claims.length,
    };
  });
  return {
    schema: "EOEssayFold@1",
    beats: beatsOut,
    assignments: Object.fromEntries([...assignments.entries()].map(([i, arr]) => [i, arr.map((a) => a.sentence)])),
    refused,
    residual,
    register: new Set(distinct.map((a) => a.core)),
    basis: `${distinct.length} distinct claim(s) folded into ${shape.length} beat(s); ${refused.length} repeated/thin lost with giver kept; ${residual.length} placed in no beat (named, never hidden)`,
  };
}

// ── THE SHAPE THE MATERIAL DECLARES ─────────────────────────────────────────
/**
 * beatsFromGround(ground, { want }) → the beats THIS material can support,
 * derived, never tabled.
 *
 * The law, applied to shape: THE GROUND SETS THE POSSIBILITY, THE ASK SETS THE
 * PROBABILITY. A beat can only exist where the material holds a cluster of
 * claims — that is what is possible. How many beats there are, and in what
 * order, is the ask's business — that is what is probable. Neither half is a
 * list of words about rivers.
 *
 * The possibility is read off the material's OWN seams: a writer's paragraph
 * break is a declaration that a part ended, and it costs nothing to believe
 * it. When the material declares none, the ask's count divides the sentences
 * evenly, which is the honest fallback — the ground offered no seam, so the
 * shape is the ask's alone and the record says so.
 *
 * A seam's CHARGE is the words that occur in it and nowhere else in the
 * material. Distinctiveness is exact here, not thresholded: a word that
 * appears in one seam distinguishes that seam, a word in every seam
 * distinguishes nothing. The TITLE is the charge's own most frequent words,
 * so a beat is labelled in the material's language rather than in ours.
 *
 * This replaces DEFAULT_ESSAY_BEATS, whose charge words were `waterway`,
 * `steamboats`, `cotton`, `flood` and `levy`. That shape folded one river
 * correctly and turned every other subject into gaps.
 */
export function beatsFromGround(ground, { want = 5, referents = null } = {}) {
  const text = String(ground ?? "").trim();
  if (!text) return { beats: [], from: "none", basis: "no ground — no shape can be derived from it" };
  const tok = (x) => String(x).toLowerCase().split(/[^a-z']+/).filter((w) => w.length > 3 && !FOLD_STOP.has(w));
  const blocks = text.split(/\n\s*\n/).map((b) => b.replace(/^#+\s*/gm, "").trim()).filter((b) => b.length > 60);
  let seams = blocks;
  let from = "the material's own seams";
  if (seams.length < 2) {
    const sentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z])/).map((x) => x.trim()).filter((x) => x.length > 20);
    if (sentences.length < 2) return { beats: [], from: "none", basis: "the ground has no seam and no sentences to divide" };
    const n = Math.max(1, Math.min(want, sentences.length));
    const per = Math.ceil(sentences.length / n);
    seams = Array.from({ length: n }, (_, i) => sentences.slice(i * per, (i + 1) * per).join(" ")).filter(Boolean);
    from = "the ask's count over an unseamed ground";
  }
  // Seam-frequency: a word that occurs in exactly one seam is that seam's own.
  const df = new Map();
  const perSeam = seams.map((sm) => {
    const counts = new Map();
    const first = new Map();
    let k = 0;
    for (const w of tok(sm)) { counts.set(w, (counts.get(w) ?? 0) + 1); if (!first.has(w)) first.set(w, k); k += 1; }
    for (const w of counts.keys()) df.set(w, (df.get(w) ?? 0) + 1);
    counts.__first = first;
    return counts;
  });
  // SEAM REFERENTS (2026-09-26): the SAME exclusivity rule the charge words
  // already use — a referent named in every seam distinguishes nothing, so
  // only a referent resolved in exactly one seam is credited to that seam's
  // beat. No resolver supplied -> every beat's referents stays [] exactly as
  // before.
  let seamReferents = seams.map(() => []);
  if (referents) {
    const perSeamIds = seams.map((sm) => { try { return [...referents.resolveText(sm)]; } catch { return []; } });
    const seamCountOf = new Map();
    for (const ids of perSeamIds) for (const id of new Set(ids)) seamCountOf.set(id, (seamCountOf.get(id) ?? 0) + 1);
    seamReferents = perSeamIds.map((ids) => [...new Set(ids)]
      .filter((id) => seamCountOf.get(id) === 1)
      .map((id) => { try { return String(referents.represent(id) ?? "").toLowerCase(); } catch { return ""; } })
      .filter(Boolean));
  }
  const beats = perSeam.map((counts, i) => {
    // Ties break on ORDER OF APPEARANCE, so a beat is titled by what its seam
    // says first rather than by what sorts first — "port, barge, aggregates",
    // not "aggregates, amphitheater, ascend".
    const first = counts.__first ?? new Map();
    const own = [...counts.entries()].filter(([w]) => df.get(w) === 1).sort((a, b) => b[1] - a[1] || (first.get(a[0]) ?? 0) - (first.get(b[0]) ?? 0));
    // A seam with no word of its own still gets a charge: its least-shared
    // words. A beat with no signature at all would swallow every claim.
    const charge = (own.length ? own : [...counts.entries()].sort((a, b) => (df.get(a[0]) - df.get(b[0])) || b[1] - a[1] || (first.get(a[0]) ?? 0) - (first.get(b[0]) ?? 0))).slice(0, 24).map(([w]) => w);
    return { title: charge.slice(0, 3).join(", ") || `part ${i + 1}`, charge: charge.join(" "), referents: seamReferents[i] };
  });
  return { beats, from, basis: `${beats.length} beat(s) from ${from}; each charged with the words that occur in its seam and nowhere else` };
}

// ── WORDS-PER-PAGE BUDGET (2026-09-26) ──────────────────────────────────────
/**
 * applyWordBudget(beats, targetWords) → { beats, dropped, basis }
 *
 * A WORD budget the CALLER already measured — never a hand-set page-to-word
 * ratio invented here (native/the-fold/parameter-induction.js's
 * induceParameter is what supplies targetWords, corroborated across real
 * sources or refusing to guess). Beats are kept in fold order; the first beat
 * is always kept (the watchmaker rule: a budget smaller than even one beat
 * still yields a usable piece, never zero beats). Every dropped beat is
 * named in the returned array and in `basis`, never silently lost.
 */
export function applyWordBudget(beats = [], targetWords = null) {
  if (!Number.isFinite(targetWords) || targetWords <= 0) {
    return { beats, dropped: [], basis: "no word budget supplied — every beat kept" };
  }
  const wordsOf = (t) => String(t ?? "").split(/\s+/).filter(Boolean).length;
  const kept = [];
  const dropped = [];
  let used = 0;
  for (const b of beats) {
    const w = wordsOf(b.text);
    if (used + w > targetWords && kept.length) { dropped.push(b); continue; }
    kept.push(b);
    used += w;
  }
  const total = beats.reduce((s, b) => s + wordsOf(b.text), 0);
  return {
    beats: kept,
    dropped,
    basis: dropped.length
      ? `${dropped.length} beat(s) left out to fit a ${targetWords}-word budget (${used} of ${total} folded words kept)`
      : `all ${kept.length} beat(s) fit within the ${targetWords}-word budget`,
  };
}

// ── the default five-beat essay shape ───────────────────────────────────────
// A generic essay arc — identity → origins → evidence → tension → return.
// The caller should usually pass the VOID'S OWN cells as beats (the shape the
// void def'd); this is the shape when the ask names no parts.
export const DEFAULT_ESSAY_BEATS = [
  { title: "The subject", charge: "identity what it is where it begins its role in the larger story of the region geography waterway course drains basin square miles headwaters length spans", referents: [] },
  { title: "The beginnings", charge: "how it came to be named founded earliest history origins first people long before native tribes expedition", referents: [] },
  { title: "The evidence", charge: "grew built served trade port commerce economy development central to steamboats cotton tobacco hub navigation barges industry hub", referents: [] },
  { title: "The tension", charge: "power danger flood risk destruction forces beyond control cost and gain damage devastation levy reservoirs", referents: [] },
  { title: "The return", charge: "today remains continues legacy future enduring memory of recreation parks riverfront identity", referents: [] },
];