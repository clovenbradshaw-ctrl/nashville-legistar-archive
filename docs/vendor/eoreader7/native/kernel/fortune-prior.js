// kernel/fortune-prior.js — FortunePrior@1: the record's OWN conviction
// structure, accumulated over time, filterable by genre, medium, and shape.
//
// Vonnegut sent OUT to extract the record's organic movements (the fortune
// curve: cumulative propositions established per position; the movements are
// where conviction climbs). Each extraction is one ENTRY, appended with its
// provenance (source, readAt, recipe) and its declared genre/medium tags. The
// prior accumulates: N records read → N entries → queries over them answer
// "what does a rising historical-text arc look like?" or "how do narrative
// prose arcs differ from technical ones?"
//
// The shape is CLASSIFIED, never tuned: from the movement gains alone, by a
// declared rule (rising / man-in-hole / decaying / flatline). A quantity may
// not be named after a state its measurement does not establish — the class
// is a description of the gains sequence, nothing more.
//
// MEDIUM-BLIND: an entry's `movements` are the caller's (vonnegut-extract
// reads text today; a score, a shot-list, a flight would render the same
// way). This file holds the ledger algebra, not any medium's grammar.
//
// GENRE IS REGISTER (Halliday — Systemic Functional Linguistics): an entry's
// `genre` is not a declared label but the FIELD (what is going on — the
// social activity), `medium` is the MODE (how the message is carried), and
// `tenor` is who takes part. Genre as a STAGED, goal-oriented social process
// (Martin on Halliday) is the movements themselves: the fortune curve's
// organic phases are the genre's schematic structure — orientation,
// complication, resolution, read off the record's own conviction curve.

export const FORTUNE_PRIOR_SCHEMA = "FortunePrior@1";

/** The declared shape classifier — from the movement GAINS alone. */
export function classifyFortuneShape(gains = [], { flatlineFloor = 0.01 } = {}) {
  const g = (gains ?? []).filter((n) => Number.isFinite(n));
  if (!g.length) return "unknown";
  const sum = g.reduce((a, b) => a + b, 0);
  const peak = Math.max(...g);
  if (sum <= flatlineFloor) return "flatline";        // nothing accumulates — argues nothing
  if (g[0] > 0 && g[g.length - 1] > 0 && peak > g[0]) return "rising"; // conviction climbs to a peak
  if (g[0] > peak * 0.7 && g[g.length - 1] < peak * 0.3) return "decaying"; // opens strong, fades
  if (g[0] < peak * 0.4 && g[g.length - 1] > g[0]) return "man-in-hole"; // weak open, recovers past it
  return "variable";
}

/**
 * appendFortune(prior, entry) → the prior with the entry appended and its
 * genre/medium/shape indexes updated. The ledger is append-only: an entry is
 * never edited, only superseded by a later reading of the same source.
 */
export function appendFortune(prior, entry) {
  const base = prior ?? { schema: FORTUNE_PRIOR_SCHEMA, standing: "received", giver: null, compiledAt: null, entries: [], byGenre: {}, byMedium: {}, byShape: {} };
  if (base.schema !== FORTUNE_PRIOR_SCHEMA) throw new TypeError(`appendFortune: schema must be ${FORTUNE_PRIOR_SCHEMA}`);
  if (!entry?.source?.file || !Array.isArray(entry.movements)) throw new TypeError("appendFortune: an entry names its source and carries movements");
  const shape = entry.shape ?? classifyFortuneShape(entry.gains ?? entry.movements.map((m) => m.gain));
  const e = { ...entry, shape, appendedAt: entry.appendedAt ?? new Date().toISOString() };
  const next = { ...base, entries: [...base.entries, e] };
  const idx = (key) => {
    const genre = String(e.genre ?? "unclassified"); next.byGenre[genre] = [...(next.byGenre[genre] ?? []), key];
    const medium = String(e.medium ?? "unclassified"); next.byMedium[medium] = [...(next.byMedium[medium] ?? []), key];
    next.byShape[shape] = [...(next.byShape[shape] ?? []), key];
  };
  idx(next.entries.length - 1);
  return next;
}

/**
 * filterFortune(prior, { genre, medium, shape }) → the entries matching ALL
 * declared filters (the intersection), each with its movements intact. No
 * filter declared = everything.
 */
export function filterFortune(prior, { genre = null, medium = null, shape = null } = {}) {
  if (!prior?.entries) return [];
  let keys = prior.entries.map((_, i) => i);
  for (const [tag, value] of Object.entries({ genre, medium, shape })) {
    if (value == null) continue;
    const wanted = new Set(prior[`by${tag[0].toUpperCase() + tag.slice(1)}`]?.[value] ?? []);
    keys = keys.filter((k) => wanted.has(k));
  }
  return keys.map((k) => ({ ...prior.entries[k], index: k }));
}

/** The compiled summary: what has the accumulated prior LEARNED? */
export function fortuneSummary(prior) {
  if (!prior?.entries?.length) return { entries: 0, byShape: {}, byGenre: {}, byMedium: {} };
  const shapeCount = {}; for (const s of prior.entries) shapeCount[s.shape] = (shapeCount[s.shape] ?? 0) + 1;
  return { entries: prior.entries.length, byShape: shapeCount, byGenre: Object.fromEntries(Object.entries(prior.byGenre ?? {}).map(([k, v]) => [k, v.length])), byMedium: Object.fromEntries(Object.entries(prior.byMedium ?? {}).map(([k, v]) => [k, v.length])) };
}

/**
 * THE FOOTPRINTS (discovered framing). A framing is the LLM's trajectory
 * through meaning space REC'd as a prior: what it found a <genre> is made of
 * — staging (phases), write voice (the prompt that produces one), felt
 * target — so the NEXT request for the genre starts from the footprints
 * instead of rediscovering from zero.
 */
export function framingFor(prior, { genre = null, medium = null } = {}) {
  if (!prior?.entries) return null;
  let latest = null;
  for (const e of prior.entries) {
    if (!e.framing) continue;
    if (genre && e.genre !== genre) continue;
    if (medium && e.medium !== medium) continue;
    // THE OMNILINGUAL READ GATE (2026-09-20, Chomsky — the universal over the
    // lexical): a STORED framing must pass the same admission test as a LIVE
    // proposal. A staging phase is a genre beat ("the moment of no return"),
    // never the machine's own words about the hunt. The sidecar once REC'd an
    // exposition framing whose staging was "The web is hunted and appended."
    // and "The genre material is hunted and appended, never assumed." —
    // machinery prose echoed from the discovery prompt's old basis footprints.
    // That stored framing was then read back and planned a five-page paper
    // around machinery prose, run after run, because append-only never forgets.
    // The universal rule: the presence of the machine's own sentence is
    // detected by its SOURCE, not its language — a stored framing is admitted
    // only when its staging was genuinely proposed (giver is a model), and a
    // framing whose staging carries the instrument's own operations (a hunt
    // disclosure, an evidence count, an egress note) is refused at read. This
    // is structural: no language list could catch the German, Chinese, or
    // Arabic restatement, but refusing the recorded footprint of a machinery
    // echo works in every language the instrument speaks. A refused framing
    // leaves `latest` at the previous clean one; an empty read is the honest
    // "no discovered framing" the register's own staging stands for.
    if (stagingIsMachinery(e.framing?.staging ?? [])) continue;
    // THE SECOND HISTORICAL PURGE (2026-09-21): the same defect, one field
    // over. `stagingIsMachinery` caught the staging that echoed the prompt's
    // basis footprints; nothing checked the WRITE VOICE, and the discovery
    // prompt used to hand the model a concrete NARRATIVE command as an `e.g.`
    // for every genre. Both stored exposition framings carry that sentence
    // verbatim, so every essay inherited a voice that forbids a thesis and
    // demands a concrete moment — which is why an essay on a river opened on
    // a skyline "like a defiant fist". The live gate is now structural (the
    // example is no longer handed over at all, so it cannot be copied in any
    // language); this is the purge for what was recorded before it existed.
    if (voiceIsEchoedExample(e.framing?.writeVoice ?? null)) continue;
    // A WRITE VOICE GOVERNS WRITING; IT IS NEVER A LINE OF THE PIECE. The
    // sidecar also holds framings whose "opening" is prose ("The salt spray
    // stings Thomas's face…") — the mouth wrote a sample where a command was
    // asked for. A sample names a particular being; a command does not.
    if (voiceIsSample(e.framing?.writeVoice ?? null)) continue;
    // PROVENANCE IS THE LOAD-BEARING RULE (2026-09-21), and the two purges
    // above are its measured special cases. Every framing in the sidecar
    // today was proposed under a prompt that HANDED THE MOUTH AN EXAMPLE, so
    // none of them is evidence of what the mouth would say on its own; the
    // purges catch the two echoes we can prove, and cannot catch a paraphrase
    // in any language. The rule that needs no vocabulary: a framing is
    // ADOPTED only when it was recorded under a gate that refuses echoes.
    //
    // This is the low/high law applied to the sidecar. An ungated entry stays
    // POSSIBILITY — it is still counted in the impression, it still tells the
    // discovery what phases this instrument has seen — but it may not become
    // PROBABILITY by being adopted as the voice a piece is written in. An
    // empty read is honest: the register's own table stands, and the next run
    // discovers afresh and records a gated entry, so this heals itself after
    // one run per genre.
    if (e.framing?.gate !== FRAMING_GATE) continue;
    latest = e; // append-only: the last footprint wins, never a merge
  }
  return latest ? { framing: latest.framing, basis: latest.basis, giver: latest.giver, readAt: latest.readAt } : null;
}

/** The omnilingual admission test for a discovered framing's staging. A phase
 *  is the genre's beat, never the machine's own sentence. Two layers:
 *
 *  (1) THE LIVE GATE IS STRUCTURAL AND OMNILINGUAL — in discovery.js, the
 *      machine's basis prose is never offered to the LLM, so a staging cannot
 *      echo it in ANY language. No language list lives there.
 *
 *  (2) THIS READ GATE is the HISTORICAL PURGE: the sidecar once REC'd a
 *      framing whose staging WAS the instrument's own self-account ("The web
 *      is hunted and appended.", "The genre material is hunted and appended,
 *      never assumed.") — recorded before the live gate existed, and read
 *      back on every essay run after. A stored framing is admitted only when
 *      its staging is not the machine's self-account. The markers are the
 *      instrument's OWN fixed self-description phrases (the language the
 *      instrument writes its account in — English today), so a genuine genre
 *      beat ("the moment of no return", a real chase scene) is never refused.
 *      The falsifying control: a staging that names a hunt AS CONTENT (a
 *      story beat about pursuit, under a clean discovery) must pass — the
 *      markers are multi-word self-account phrases, not the word "hunt".
 */
export function stagingIsMachinery(staging) {
  const phases = Array.isArray(staging) ? staging : [];
  if (!phases.length) return false;
  // The instrument's self-account, as recorded: multi-word, distinctive,
  // describing ITS OWN operations — never a genre's beat.
  const SELF_ACCOUNT = /\b(?:is hunted and appended|hunted and appended,? never assumed|the egress is open|coverage fragment|recency.?frequency cells|meaning-options?|genre material is hunted)\b/i;
  return phases.some((p) => SELF_ACCOUNT.test(String(p ?? "")));
}

/**
 * voiceIsEchoedExample(writeVoice) → was this voice copied verbatim from the
 * discovery prompt's own `e.g.`? A RECORDED HISTORICAL ARTEFACT, not a
 * vocabulary: these two sentences are the exact bytes discovery.js used to
 * hand over, so matching them is matching our own past output, never a
 * language. New proposals cannot reach this state — the example is no longer
 * handed over, and an echo of the ask is refused live.
 */
/** The gate a framing must have been recorded under to be ADOPTED. Bumping
 *  this string retires every earlier framing to possibility-only, which is
 *  the correct move whenever the discovery prompt itself changes. */
export const FRAMING_GATE = "EOFramingGate@1";

const HANDED_OVER_EXAMPLES = [
  "begin in the middle of a concrete moment, in a real place, showing the senses; never a thesis, never a summary, never name the genre or the structure.",
  "write the scene: what happens, who acts, what changes, what is felt. never name the phase or the structure, never analyze, never comment on the writing.",
];
export function voiceIsEchoedExample(writeVoice) {
  if (!writeVoice || typeof writeVoice !== "object") return false;
  const norm = (x) => String(x ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  for (const field of [writeVoice.opening, writeVoice.body]) {
    const n = norm(field);
    if (!n) continue;
    for (const ex of HANDED_OVER_EXAMPLES) if (n === ex || n.includes(ex) || ex.includes(n)) return true;
  }
  return false;
}

/**
 * voiceIsSample(writeVoice) → is this a line of the piece instead of a
 * command about writing it? A command is genre-general and names no
 * particular being; a sample names one ("Thomas", "the Cumberland"). The
 * signal is a proper name appearing where a sentence does not begin.
 *
 * THE CEILING, STATED: capitalisation is the signal, so this test does real
 * work only in a script that HAS case. In Chinese, Japanese, Arabic, Hebrew,
 * Hindi or Thai it returns false and guards nothing — there the register's
 * own voice table is the floor. Naming the ceiling beats faking a floor.
 */
export function voiceIsSample(writeVoice) {
  if (!writeVoice || typeof writeVoice !== "object") return false;
  for (const field of [writeVoice.opening, writeVoice.body]) {
    const text = String(field ?? "").trim();
    if (!text) continue;
    let hasCase = false;
    for (const ch of text) { if (ch.toUpperCase() !== ch.toLowerCase()) { hasCase = true; break; } }
    if (!hasCase) continue;
    // Sentence-initial capitals are grammar, not names: drop the first token
    // of the text and of every sentence that follows a terminator.
    const words = text.split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1] ?? "";
      if (/[.!?:;]$/.test(prev)) continue;          // a new sentence begins
      const w = words[i].replace(/[^\p{L}'']/gu, "");
      if (w.length < 2) continue;
      if (/^\p{Lu}/u.test(w) && !/^\p{Lu}+$/u.test(w)) return true;
    }
  }
  return false;
}

export function appendFraming(prior, { genre, medium = "text", framing, basis = null, giver = null } = {}) {
  if (!framing || typeof framing !== "object") throw new TypeError("appendFraming: a framing object is required");
  const entry = {
    source: { file: `framing:${genre}:${medium}`, sha: `framing-${genre}-${medium}`.slice(0, 16), chars: JSON.stringify(framing).length },
    readAt: new Date().toISOString(),
    recipe: "discovered framing — the LLM's trajectory through meaning space, REC'd as footprints",
    genre, medium, subgenre: null,
    movements: [{ focus: "framing", from: 0, to: 1, freshClaims: 1, gain: 1 }],
    gains: [1], shape: "framing",
    framing: { ...framing, gate: FRAMING_GATE },
    basis, giver,
  };
  return appendFortune(prior, entry);
}