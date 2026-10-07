// native/the-fold/corpus-resonance.js — the SAME covert discipline
// ground-attention.js already holds ("not the words of the archon, but
// their style of thinking"), extended to fire even when no ground
// criterion applies. Never a named, credited quote — that was tried and
// corrected mid-session ("something subtler"): archon-compendium.js's
// `credit`/`work` fields stay exactly what its own header says they are
// for (a DIFFERENT, explicit-citation use), never touched here. What
// actually gets used is an archon's `role` field — read across the real
// compendium these are already plain, unnamed, principle-level sentences
// ("it is in the bytes the eyes and ears can witness, or it isn't") —
// this file's real job is picking WHICH one actually resonates.
//
// TWO BAG-OF-WORDS ATTEMPTS WERE TRIED AND FALSIFIED FIRST, disclosed
// rather than deleted from memory: matchArchons' own topic-overlap count
// ranked bukhari above mozi for "eyewitness account" (both hit "witness"
// as a substring, and the tie broke on ARRAY ORDER, not fit) and matched
// Barbara Partee to "what time is it" (a single incidental "time" hit). A
// TF-IDF re-rank over the compendium's own role+work+topics text was
// tried next and made things WORSE, not better — a corpus of ~60 short
// entries is too small and sparse for TF-IDF's document-frequency
// statistics to mean anything; it matched "synapse" to the same
// eyewitness query purely because its role text contains "fires" (the
// verb), colliding with "harbor fire" (the noun). No hand-rolled word
// heuristic survived contact with real test cases.
//
// THE FIX: real semantic embeddings (Ollama's nomic-embed-text, already
// pulled locally — POST /api/embed, {model, input} -> {embeddings}),
// cosine similarity, and a REAL MEASURED NULL rather than a hand-set
// threshold (this session's own standing rule): a fixed set of genuinely
// off-topic calibration queries is embedded once, its own best-match
// similarity against the compendium gives the ceiling incidental overlap
// alone can produce, and a real task's best match must clear it. Archon
// embeddings and the null's own ceiling are computed once per process
// and cached — the compendium and the calibration set are both static.
import { MOUTH_URL, MOUTH_IDENTITY } from "../kernel/mouth.js";
const OLLAMA = MOUTH_URL; // the mouth — embeddings enter there, never the daemon past her
const EMBED_MODEL = process.env.ER7_EMBED_MODEL ?? "nomic-embed-text";

// A fixed, disclosed calibration set — deliberately ordinary, off-topic
// questions, none of which should genuinely resonate with any archon's
// evidentiary/stylistic domain. Declared once, never tuned against a
// specific archon's own score (that would be calibrating on the answer
// key, the exact mistake this repo's own CLAUDE.md names and forbids).
// Exported because the off-topic-ness of these queries is domain-agnostic
// by construction — a second caller ranking a DIFFERENT candidate set
// (prior-resonance.js's live_priors documents) reuses this same set rather
// than restating an equivalent list that could quietly drift from it.
export const NULL_QUERIES = Object.freeze([
  "what time is it",
  "how do I boil an egg",
  "what's the weather tomorrow",
  "tell me a joke",
  "how far is the moon",
  "what's 2 plus 2",
  "recommend a good movie",
  "how do I tie my shoes",
]);

export async function embed(inputs, { ollamaUrl = OLLAMA, model = EMBED_MODEL } = {}) {
  const res = await fetch(`${ollamaUrl}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json", ...MOUTH_IDENTITY, "x-er7-kind": "embed" },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!res.ok) throw new Error(`corpus-resonance: embedding request failed (${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data.embeddings)) throw new Error("corpus-resonance: embedding response carried no embeddings");
  return data.embeddings;
}

export function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

const archonText = (a) => `${a.role}. ${a.work}`;

/**
 * buildResonanceCache(items, textOf, { calibration, ollamaUrl, model }) —
 * the general half of resonantPrinciple's own mechanism, extracted so a
 * SECOND candidate domain (prior-resonance.js's corpus documents) can reuse
 * it rather than re-implementing embed-once/cosine/measured-null-ceiling a
 * second time (this repo's own repeated anti-drift lesson — P22/P24/P39's
 * postmortems). `textOf(item)` extracts what gets embedded for each item;
 * `calibration` defaults to NULL_QUERIES but is overridable for a domain
 * whose own off-topic set would differ (not needed today — kept open).
 */
export async function buildResonanceCache(items, textOf, { calibration = NULL_QUERIES, ollamaUrl, model } = {}) {
  const opts = { ollamaUrl, model };
  const texts = items.map(textOf);
  const vecs = await embed(texts, opts);
  const itemVecs = items.map((item, i) => ({ item, vec: vecs[i] }));

  // The null: each calibration query's own best-match similarity against
  // this same item set, and the ceiling is the maximum of those — a real
  // query must beat what genuinely unrelated text already achieves by
  // coincidence, not an arbitrary fraction picked by eye.
  const nullVecs = await embed([...calibration], opts);
  let ceiling = 0;
  for (const nv of nullVecs) {
    let best = 0;
    for (const iv of itemVecs) best = Math.max(best, cosine(nv, iv.vec));
    ceiling = Math.max(ceiling, best);
  }
  return { itemVecs, ceiling };
}

/**
 * resonantMatch(query, cache, { ollamaUrl, model }) — the single best item
 * in `cache` for `query`, or null if nothing clears the cache's own
 * measured ceiling. The other half of resonantPrinciple's mechanism,
 * exported so a caller wanting only the best match (not a ranked list)
 * reuses this rather than re-deriving the "beat the ceiling" rule.
 */
export async function resonantMatch(query, cache, { ollamaUrl, model } = {}) {
  const opts = { ollamaUrl, model };
  const [queryVec] = await embed([String(query ?? "")], opts);
  let best = null, bestSim = -Infinity;
  for (const iv of cache.itemVecs) {
    const sim = cosine(queryVec, iv.vec);
    if (sim > bestSim) { bestSim = sim; best = iv; }
  }
  if (!best || bestSim <= cache.ceiling) return null;
  return { item: best.item, similarity: bestSim, ceiling: cache.ceiling };
}

let cache = null; // { itemVecs: [{item: archon, vec}], ceiling: number }

/**
 * resonantPrinciple(task, { archons, ollamaUrl, model }) — the covert
 * fallback fact, or null if nothing clears the measured null ceiling.
 * `archons` is injected (the real compendium's own ARCHONS array, never
 * reimplemented). Throws only on a genuine embedding-service failure —
 * callers should catch, the same discipline groundFactFor already holds.
 * Unchanged behavior after the buildResonanceCache/resonantMatch
 * extraction above — this function is now a thin composition of the two,
 * verified byte-identical against its own pre-existing test file.
 */
export async function resonantPrinciple(task, { archons, ollamaUrl, model } = {}) {
  if (!Array.isArray(archons) || !archons.length) throw new TypeError("resonantPrinciple: archons is injected — the real compendium's own ARCHONS array");
  const opts = { ollamaUrl, model };
  if (!cache) cache = await buildResonanceCache(archons, archonText, opts);
  const m = await resonantMatch(task, cache, opts);
  if (!m) return null;
  return Object.freeze({ text: m.item.role, handle: m.item.handle, similarity: m.similarity, ceiling: m.ceiling });
}

/** Test-only: force a fresh cache (a real Ollama instance is required —
 * this file makes no non-embedding fallback, per this session's own
 * "model is just the mouth" discipline: never approximate an embedding
 * with a word heuristic and call it the same thing). */
export function _resetCacheForTests() { cache = null; }
