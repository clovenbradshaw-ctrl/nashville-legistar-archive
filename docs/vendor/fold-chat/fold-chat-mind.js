// fold-chat-mind.js — the chat's perceiving step, pure (no DOM, no IO, no model).
//
// The chat is a surface; it must not retrieve by string search on the raw words
// of the last message. khora/native/docs/THE-HOLOGRAPH.md §6: "A question
// activates referents — its own, or the last answer's when it names none." This
// module is that step for a chat turn:
//
//   admitReferents   what a finished turn established (its question, its answer,
//                    and the titles of the sources that grounded it) becomes the
//                    chat's referent record. A source TITLE is the strongest
//                    authority for an entity's name — it is in the language and
//                    script of the source, never inferred from capitalisation.
//   resolveQuestion  a question that names none of its own referents is read
//                    through the record's most active ones, and says so: the
//                    result carries what was carried and why, so the surface can
//                    show "Read 'him' as …" and the person can correct it.
//
// OMNILINGUAL BY CONSTRUCTION (THE-HOLOGRAPH.md §"Reading is omnilingual…"):
// nothing here keys on capital letters unless the SCRIPT says case is
// significant. `capitalisationIsSignificant` is a fact about a script, so Han,
// Kana, Hangul, Arabic, Hebrew, Devanagari and Thai never read as 'no beings'.
// Word boundaries come from Intl.Segmenter, not from spaces.
//
// NOTHING IS A SETTING WITHOUT A GIVER (Constitution II.11): the few numbers
// below are named declarations in DECLARED, each with the reason it stands, not
// measured constants. Language priors (pronoun forms, titles) are INJECTED
// (`hints`), never hand-typed here; they come from the ethos priors.

export const DECLARED = Object.freeze({
  // How many of the most active referents a question with no entity of its own
  // activates. Declared, not measured: the surface shows the carry and the
  // person can remove it. 2 keeps a person and the place they belong to.
  carryMax: 2,
  // A question this long (in word-like segments) names enough on its own that
  // carrying a referent would be a guess, even if no known referent matched.
  selfSufficientSegments: 9,
  // Referent record cap: the oldest, least-active entries fall off.
  recordMax: 24,
  // Weight per turn of age (activation decays; THE-HOLOGRAPH §6 'decays at a
  // rate the material measures' — until measured, this is a declared 0.8).
  decay: 0.8,
});

// ── script ────────────────────────────────────────────────────────────────

const SCRIPTS = [
  ["Han", /\p{Script=Han}/u],
  ["Hiragana", /\p{Script=Hiragana}/u],
  ["Katakana", /\p{Script=Katakana}/u],
  ["Hangul", /\p{Script=Hangul}/u],
  ["Arabic", /\p{Script=Arabic}/u],
  ["Hebrew", /\p{Script=Hebrew}/u],
  ["Devanagari", /\p{Script=Devanagari}/u],
  ["Thai", /\p{Script=Thai}/u],
  ["Cyrillic", /\p{Script=Cyrillic}/u],
  ["Greek", /\p{Script=Greek}/u],
  ["Latin", /\p{Script=Latin}/u],
];

/** The dominant script of a text by letter count ('Other' when there are no letters). */
export function scriptOf(text) {
  const counts = new Map();
  for (const ch of String(text ?? "")) {
    if (!/\p{L}/u.test(ch)) continue;
    for (const [name, re] of SCRIPTS) if (re.test(ch)) { counts.set(name, (counts.get(name) || 0) + 1); break; }
  }
  // Japanese mixes Han with Kana: any Kana makes the text Japanese-script.
  if (counts.get("Hiragana") || counts.get("Katakana")) return "Japanese";
  let best = "Other", n = 0;
  for (const [k, v] of counts) if (v > n) { best = k; n = v; }
  return best;
}

/** Is letter case a mark of proper names in this script? A fact about the script. */
export const capitalisationIsSignificant = (script) => script === "Latin" || script === "Cyrillic" || script === "Greek";

/** Scripts written without spaces between words (segmentation is not by whitespace). */
export const isUnspaced = (script) => script === "Han" || script === "Japanese" || script === "Thai";

// ── word-like segments ─────────────────────────────────────────────────────

const WORD = /\p{L}|\p{N}/u;
let segmenters = new Map();
function segmenterFor(locale) {
  if (typeof Intl === "undefined" || !Intl.Segmenter) return null;
  if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale, { granularity: "word" }));
  return segmenters.get(locale);
}
const LOCALE_OF = { Han: "zh", Japanese: "ja", Hangul: "ko", Thai: "th", Arabic: "ar", Hebrew: "he", Devanagari: "hi", Cyrillic: "ru", Greek: "el", Latin: "en", Other: "en" };

/** Word-like segments of a text, with their offsets, as the SCRIPT segments them. */
export function segments(text, script = scriptOf(text)) {
  const s = String(text ?? "");
  const seg = segmenterFor(LOCALE_OF[script] || "en");
  const out = [];
  if (seg) {
    for (const x of seg.segment(s)) if (x.isWordLike) out.push({ text: x.segment, start: x.index, end: x.index + x.segment.length });
  } else {
    const re = /[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu; let m;
    while ((m = re.exec(s)) !== null) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Case- and diacritic-fold a surface for matching (never for display). */
export function fold(s) {
  return String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
}

// ── candidate entities ─────────────────────────────────────────────────────

// What each Wikipedia calls itself in its own script. A wrapper is not a name: strip it.
// (A giver-less list would be a hand-typed setting; this one is DECLARED data about
// the web's own site names, and an unlisted language simply keeps its wrapper — a
// longer entity string, never a wrong one.)
export const SITE_NAMES = Object.freeze(["wikipedia", "wikipédia", "википедия", "вікіпедія", "维基百科", "維基百科", "ウィキペディア", "위키백과", "ويكيبيديا", "ויקיפדיה", "विकिपीडिया", "วิกิพีเดีย", "βικιπαίδεια", "vikipedi", "ویکی‌پدیا", "ویکیپدیا", "wikipedie", "wikipedija", "wikipedia"]);
const SITE_RE = SITE_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

/** The entity name a source title carries: "Wikipedia — Nashville, Tennessee" → "Nashville, Tennessee". */
export function entityFromTitle(title) {
  let t = String(title ?? "").trim();
  t = t.replace(new RegExp(`^\\s*(?:${SITE_RE})\\s*[—–\\-:|·]\\s*`, "iu"), "");
  t = t.replace(new RegExp(`\\s*[—–\\-|·]\\s*(?:${SITE_RE})\\s*$`, "iu"), "");
  t = t.replace(/\s*\([^)]*\)\s*$/u, "");
  return t.trim();
}

/** Capitalised runs ("Judge Richard Henderson") — ONLY in scripts where case marks names.
 *  A linking particle ("van", "de", "al"…) only counts as a whole word, and a run ends at a sentence boundary
 *  ("Napoleon Bonaparte also…" is "Napoleon Bonaparte", never "Napoleon Bonaparte al"; "Henderson. The French"
 *  is two things). Measured defects 2026-10-05 (ethos study E4): 7.4% of runs ended in a particle fragment. */
const INITIAL = /^\p{Lu}\.$/u;                 // "J." in "J. R. R. Tolkien" is part of a name, not a sentence end
const TITLE_DOT = /^(?:Mr|Mrs|Ms|Dr|Prof|St|Sr|Jr|Mt|Gen|Col|Capt|Lt|Sgt|Rev|Hon)\.$/u;
export function casedRuns(text, script = scriptOf(text), { minLength = 2, functionWords = null } = {}) {
  // functionWords: a Set of case-folded closed-class words (the ethos-derived list, eval/priors/out/function-words-v1.json),
  // INJECTED, never typed here. A sentence-initial run sheds leading ones ("Then Napoleon Bonaparte" → "Napoleon Bonaparte").
  const fw = functionWords instanceof Set ? functionWords : null;
  if (!capitalisationIsSignificant(script)) return [];
  const s = String(text ?? ""), out = [];
  const PARTICLE = "(?:de|da|di|del|della|du|des|la|le|von|van|der|den|ter|of|y|e|bin|ibn|al)(?![\\p{L}\\p{N}])";
  const re = new RegExp("(?<![\\p{L}\\p{N}])(\\p{Lu}[\\p{L}\\p{N}.'’-]*(?:[ \\t]+(?:\\p{Lu}[\\p{L}\\p{N}.'’-]*|" + PARTICLE + "))*)", "gu");
  let m;
  while ((m = re.exec(s)) !== null) {
    // cut the run at the first token that ends a sentence (a word ending in '.', that is not an initial or a title)
    const toks = m[1].split(/[ \t]+/); const kept = [];
    for (const t of toks) {
      if (/\.$/.test(t) && !INITIAL.test(t) && !TITLE_DOT.test(t)) { kept.push(t.replace(/\.+$/u, "")); break; }
      kept.push(t);
    }
    while (kept.length && new RegExp("^" + PARTICLE + "$", "u").test(kept[kept.length - 1])) kept.pop(); // never end on a particle
    // a possessive is not part of a name ("Tolkien's" → "Tolkien"; Latin-script possessive, harmless elsewhere)
    const run = kept.join(" ").replace(/['’]s$/iu, "").replace(/[\s.'’-]+$/u, "");
    // A sentence-initial single capitalised WORD is a sentence opener, not a name.
    const atStart = m.index === 0 || /[.!?¿¡]\s*$|\n\s*$/u.test(s.slice(0, m.index));   // a line break opens a sentence too: every line of a poem begins with a capital ("With", "But" were admitted as referents — G3)
    let surface = run, shed = false;
    if (atStart && fw) { const parts = run.split(/\s+/); while (parts.length > 1 && fw.has(fold(parts[0]))) { parts.shift(); shed = true; } if (parts.length === 1 && fw.has(fold(parts[0]))) continue; surface = parts.join(" "); }
    // a lone capitalised word left AFTER a shed opener ("The French" → "French") is no longer sentence-initial
    if (atStart && !shed && !/\s/.test(surface)) continue;
    if (surface.length >= minLength) out.push({ surface, start: m.index + (run.length - surface.length), end: m.index + run.length });
  }
  return out;
}

/** Does `needle` (a known surface) occur in `text`, folded, on word boundaries where the script has them? */
export function mentions(text, needle) {
  const hay = fold(text), n = fold(needle).trim();
  if (!n) return false;
  const script = scriptOf(needle) !== "Other" ? scriptOf(needle) : scriptOf(text);
  if (isUnspaced(script)) return hay.includes(n);
  const i = hay.indexOf(n);
  if (i < 0) return false;
  const before = hay[i - 1], after = hay[i + n.length];
  return !(before && WORD.test(before)) && !(after && WORD.test(after));
}

// ── the referent record ────────────────────────────────────────────────────

/** A fresh record. Plain data (JSON-safe), stored on the session as `s.referents`. */
export const emptyReferents = () => ({ entities: [], turn: 0 });

function upsert(rec, surface, add) {
  const key = fold(surface);
  if (!key) return;
  let e = rec.entities.find((x) => fold(x.surface) === key);
  if (!e) {
    // A shorter known surface that is a word-bounded part of this one (or vice versa) is the same being.
    e = rec.entities.find((x) => mentions(surface, x.surface) || mentions(x.surface, surface));
    if (e && surface.length > e.surface.length) { e.forms = [...new Set([...(e.forms || []), e.surface])]; e.surface = surface; }
    else if (e) e.forms = [...new Set([...(e.forms || []), surface])];
  }
  if (!e) { e = { surface, forms: [], weight: 0, lastTurn: rec.turn, roles: [] }; rec.entities.push(e); }
  e.weight += add.weight;
  e.lastTurn = rec.turn;
  if (add.role && !e.roles.includes(add.role)) e.roles.push(add.role);
}

/**
 * Fold a finished turn into the record.
 *   turn = { question, answer, sources: [{ title }], groundedSources?: [indexes] }
 * Weights (declared, not measured): a source title 3 (the strongest authority for a
 * name), a cased run in the ANSWER 2, in the QUESTION 2, an answer-run that is also in
 * a title +1 more. Entities from caseless scripts enter only through source titles and
 * through title-substrings that the question or answer repeats.
 */
export function admitReferents(record, turn, { hints = null } = {}) {
  const rec = { entities: (record?.entities || []).map((e) => ({ ...e, forms: [...(e.forms || [])], roles: [...(e.roles || [])] })), turn: (record?.turn || 0) + 1 };
  for (const e of rec.entities) e.weight *= DECLARED.decay;
  const q = String(turn?.question ?? ""), a = String(turn?.answer ?? "");
  const titles = (turn?.sources || []).map((s) => entityFromTitle(s?.title)).filter(Boolean);
  const titleSet = [...new Set(titles)];
  for (const t of titleSet) {
    upsert(rec, t, { weight: 3, role: "title" });
    // "Nashville, Tennessee" → also the head "Nashville" (the part before a comma), a surface people actually use.
    const head = t.split(/[,，、]/u)[0].trim();
    if (head && head !== t) upsert(rec, head, { weight: 1, role: "title-head" });
  }
  // a CREATIVE answer (a song, a poem) is invention, not a statement about the world: it names no referent (its capitalised lines were becoming ones). The question and the titles still do.
  for (const [text, role] of [[turn?.creative ? "" : a, "answer"], [q, "question"]]) {
    for (const r of casedRuns(text, scriptOf(text))) {
      const inTitle = titleSet.some((t) => mentions(t, r.surface) || mentions(r.surface, t));
      upsert(rec, r.surface, { weight: 2 + (inTitle ? 1 : 0), role });
    }
  }
  // Caseless scripts: a stretch of the answer/question that a source title also contains IS a name
  // (the title is the authority); take the longest common stretch of word-like segments.
  for (const [text, role] of [[turn?.creative ? "" : a, "answer"], [q, "question"]]) {
    const script = scriptOf(text);
    if (capitalisationIsSignificant(script) || script === "Other") continue;
    for (const t of titleSet) {
      const common = longestCommonStretch(text, t, script);
      if (common && fold(common).length >= 2) upsert(rec, common, { weight: 2, role });
    }
  }
  if (hints?.titles) rec.titlesHint = hints.titles.length; // provenance only; titles are consumed by personLike
  rec.entities.sort((x, y) => y.weight - x.weight);
  rec.entities = rec.entities.filter((e) => e.weight > 0.2).slice(0, DECLARED.recordMax);
  return rec;
}

/** Longest common contiguous run of word-like segments between two texts (script-segmented). */
export function longestCommonStretch(a, b, script = scriptOf(a)) {
  const sa = segments(a, script).map((x) => fold(x.text)), sb = segments(b, scriptOf(b) === "Other" ? script : scriptOf(b)).map((x) => fold(x.text));
  const ta = segments(a, script), tb = segments(b, scriptOf(b) === "Other" ? script : scriptOf(b));
  let best = 0, ai = 0, bi = 0;
  const dp = Array.from({ length: sa.length + 1 }, () => new Array(sb.length + 1).fill(0));
  for (let i = 1; i <= sa.length; i++) for (let j = 1; j <= sb.length; j++) {
    if (sa[i - 1] === sb[j - 1]) { dp[i][j] = dp[i - 1][j - 1] + 1; if (dp[i][j] > best) { best = dp[i][j]; ai = i; bi = j; } }
  }
  if (!best) return null;
  const run = ta.slice(ai - best, ai);
  const text = String(a).slice(run[0].start, run[run.length - 1].end);
  // a stretch that is only one very short segment in a spaced script is a function word, not a name
  if (!isUnspaced(script) && best === 1 && text.length < 3) return null;
  return text;
}

// ── activation ─────────────────────────────────────────────────────────────

/**
 * Likely a person: a multi-word cased run, or one that starts with a title the hints name.
 * (Used only to match a pronoun class to a referent when hints say the pronoun is personal.)
 */
export function personLike(surface, hints = null) {
  const script = scriptOf(surface);
  const segs = segments(surface, script);
  if (hints?.titles?.some((t) => fold(segs[0]?.text) === fold(t))) return true;
  return capitalisationIsSignificant(script) && segs.length >= 2 && !/[,，]/u.test(surface);
}

/** Does the question mention any referent the record already holds? → those, most active first. */
export function activated(question, record) {
  return (record?.entities || []).filter((e) => [e.surface, ...(e.forms || [])].some((f) => mentions(question, f)));
}

/**
 * Read a question in the light of the chat's referent record.
 *
 *   resolveQuestion(question, record, { hints })
 *   hints (injected from the ethos priors — eval/priors/out/hints-v1.json — never typed here):
 *     carryTriggers:    [forms] — pronoun forms that signal 'the last answer's referent' in this language
 *     personalPronouns: [forms] — gendered personal forms; when one is matched, only person-like referents carry
 *                                 (not for Russian: он/его also refer to masculine inanimates — use those as triggers only,
 *                                 i.e. put them in carryTriggers and leave them out of personalPronouns)
 *     titles:           [forms] — honorific titles that begin a personal name
 *
 * WHEN IT CARRIES — only on a trigger. The first version carried on ANY short question with no entity of its own;
 * measured on 60 new-topic questions (ethos study E4, 2026-10-05) 85% wrongly inherited the last topic's referents.
 * Gating on the language's pronoun forms cut that to 18% (en+ru, any pronoun) and, with gendered forms only,
 * to 0/60 — at the price of carrying less (50% carry-correct in English, 85% in Russian). A question with no
 * trigger therefore carries NOTHING (reason 'no-trigger'): the retrieval step may still try the previous turn's
 * referents as a SECOND query and keep them only if the results' titles agree (titleAgreement).
 * A language with no pronoun prior (es, zh…) has no trigger and so never carries: a typed gap, not a guess.
 *
 * Returns { said, resolved, carried:[{surface, by}], reason, script, segments }.
 *   - the question names a known referent  → nothing is carried (reason 'names-its-own')
 *   - the question names its own entity    → nothing is carried (reason 'has-own-entity')
 *   - the question is long enough to stand → nothing is carried (reason 'self-sufficient')
 *   - no trigger form in the question      → nothing is carried (reason 'no-trigger')
 *   - otherwise the record's top referents are carried ('activation:last-answer+pronoun').
 * The carry is APPENDED to the question as 'about: A; B' for the search, and `resolved`
 * is that string — the surface shows `carried` to the person; it never rewrites `said`.
 */
export function resolveQuestion(question, record, { hints = null, rejected = null, gate = null } = {}) {
  const said = String(question ?? "").trim();
  const script = scriptOf(said), segs = segments(said, script);
  const base = { said, resolved: said, carried: [], script, segments: segs.length };
  if (!said || !(record?.entities || []).length) return { ...base, reason: "no-record" };
  // THE ANAPHORA GATE (fold-chat-anaphora.js, G3): when the caller hands the verdict, IT decides whether the ask leans on the last answer — not the
  // ethos `carryTriggers` prior (which lists "the" and "one": every ask with an article was read as pointing back). A self-contained ask carries nothing;
  // an anaphoric one carries even where the language has no trigger list (es, fr), and even beside an entity of its own ("what happened to him after Waterloo").
  if (gate && gate.carry === false) return { ...base, reason: "gate-standalone" };
  const forced = !!(gate && gate.carry === true);
  if (!forced && activated(said, record).length) return { ...base, reason: "names-its-own" };
  if (forced && activated(said, record).length && gate.kind !== "pronoun") return { ...base, reason: "names-its-own" };
  if (!forced && casedRuns(said, script).length) return { ...base, reason: "has-own-entity" };
  if (!forced && segs.length >= DECLARED.selfSufficientSegments) return { ...base, reason: "self-sufficient" };
  const forms = (arr) => (Array.isArray(arr) ? arr : []).map(fold);
  const triggers = new Set([...forms(hints?.carryTriggers), ...forms(hints?.personalPronouns)]);
  const hit = forced || segs.some((x) => triggers.has(fold(x.text)));
  if (!hit) return { ...base, reason: "no-trigger" };
  // a referent the person has refused to have carried into this thread (fold-chat-minds.js rejectedSurfaces) is never carried again
  const refused = new Set((Array.isArray(rejected) ? rejected : []).map((x) => fold(x).trim()));
  const allowed = (e) => !refused.has(fold(e.surface).trim());
  let pool = [...record.entities];
  const personal = new Set(forms(hints?.personalPronouns));
  if (segs.some((x) => personal.has(fold(x.text)))) {
    const people = pool.filter((e) => personLike(e.surface, hints));
    // "her" after "not her": the person was refused, so the pool is the people left, not the things (no fall-back to a non-person)
    if (people.length) pool = people;
  }
  pool = pool.filter(allowed);
  pool.sort((x, y) => y.weight - x.weight);
  const carried = pool.slice(0, DECLARED.carryMax).map((e) => ({ surface: e.surface, by: "activation:last-answer+pronoun" }));
  if (!carried.length) return { ...base, reason: "nothing-to-carry" };
  return { ...base, carried, resolved: `${said} (about: ${carried.map((c) => c.surface).join("; ")})`, reason: "carried" };
}

/**
 * The query for the search step: the question's own words plus any carried referents.
 * Returned as a list so the caller may issue the raw question too and keep whichever
 * result set's top titles actually mention the asker's referent (see `titleAgreement`).
 */
export function searchQueries(resolution) {
  if (!resolution?.carried?.length) return [resolution?.said || ""].filter(Boolean);
  const names = resolution.carried.map((c) => c.surface);
  return [`${names.join(" ")} ${resolution.said}`.trim(), resolution.said];
}

/**
 * How well do result titles agree with the referents we expect? A fraction in [0,1]:
 * the share of the top-k titles that mention at least one expected surface. Used to
 * choose between the carried query's results and the raw query's, and to draw a typed
 * gap ('retrieval does not mention the referent') instead of reading an off-topic page.
 */
export function titleAgreement(titles, surfaces, k = 5) {
  const top = (titles || []).slice(0, k);
  if (!top.length || !(surfaces || []).length) return 0;
  const hit = top.filter((t) => surfaces.some((s) => mentions(t, s) || mentions(entityFromTitle(t), s))).length;
  return hit / top.length;
}
