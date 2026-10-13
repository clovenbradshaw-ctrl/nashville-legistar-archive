// fold-chat-route.js — where should the fold look for THIS kind of ask?
//
// Before this, every non-fast turn hit every source (Wikipedia, GitHub, the
// Internet Archive, OpenAlex, Crossref) for every question — so "whats a good
// pancake recipe?" read Okonomiyaki, Recipe and Shrove Tuesday off Wikipedia
// while the one source that could answer it (the open web) sat unread.
//
// The router answers "where do I look?" in two mechanical steps, no model:
//
//   1. routeSources(question)  — each source declares the cues it is good for;
//      the open web is ALWAYS on; a specialist runs only when a cue fires.
//   2. probeSources(results)   — after the web search, the domains that came
//      back vote: arxiv/pubmed in the web hits pulls in the paper sources,
//      github.com pulls in GitHub, and so on. The web results tell us what
//      kind of thing this is better than the question's words do.
//
// Plus two safety nets: if the web search came back empty the fold falls back to
// every source (a relay outage must not leave it with nothing), and a source
// that answered 429 is left alone for a cooldown instead of being hammered.
//
// Pure + testable: no fetch, no DOM. The cooldown clock is injectable.

// What each specialist is good for. `cues` are regexes over the question; a hit
// scores the source and is named in `why` so the trace says why it ran.
export const AFFINITY = Object.freeze({
  wikipedia: {
    cues: [
      [/\b(who (?:is|was|were)|what (?:is|are|was|were)|history of|define|definition|meaning of|biography|founded|capital of|born|died|origin of|explain|tell me about|overview of|founding|compare|contrast|differences? between|\bvs\.?)\b/i, "an encyclopedic ask (definition, history, comparison)"],
    ],
  },
  github: {
    cues: [
      [/\b(github|repo(?:sitory)?|open[- ]source|npm|pip|pypi|crate|library|libraries|framework|sdk|cli|package|api client|source code|implementation of|code for|plugin|extension for)\b/i, "a code / tooling ask"],
      [/\b(javascript|typescript|python|rust|golang|node\.?js|react|vue|django|rails|kubernetes|docker|linux)\b/i, "names a language or stack"],
    ],
  },
  papers: {
    scopes: ["openalex", "crossref"],
    cues: [
      [/\b(study|studies|research|paper|papers|journal|peer[- ]reviewed|meta-?analysis|systematic review|clinical trial|randomi[sz]ed|evidence for|effect of|effects of|doi|citation|literature|hypothesis|et al)\b/i, "a research ask"],
    ],
  },
  archive: {
    cues: [
      [/\b(book|books|out[- ]of[- ]print|public domain|manuscript|archive|archival|recording|full text|scanned|newspaper from|historical document|first edition|\b1[0-8][0-9]{2}s)\b/i, "a book / historical-document ask"],
    ],
  },
});

// Source host → the specialist it implies, for the probe.
const HOST_VOTES = [
  [/(^|\.)(arxiv\.org|pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov|doi\.org|sciencedirect\.com|nature\.com|springer\.com|jstor\.org|biorxiv\.org|medrxiv\.org|semanticscholar\.org|researchgate\.net|ssrn\.com|plos\.org|thelancet\.com|nejm\.org)$/i, "papers", "web hits are journals / preprints"],
  [/(^|\.)(github\.com|gitlab\.com|npmjs\.com|pypi\.org|crates\.io|stackoverflow\.com)$/i, "github", "web hits are code hosts"],
  [/(^|\.)(wikipedia\.org|britannica\.com)$/i, "wikipedia", "web hits are encyclopedia pages"],
  [/(^|\.)(archive\.org|gutenberg\.org|hathitrust\.org)$/i, "archive", "web hits are archives / book hosts"],
];

const ALL = ["web", "wikipedia", "github", "archive", "openalex", "crossref"];
const expand = (key) => (key === "papers" ? AFFINITY.papers.scopes : [key]);

/**
 * Step 1 — route by the question's own words.
 * @returns { scopes: ["web", …], why: { scope: reason }, rest: [scopes not chosen] }
 */
/** Is this a plain factual ask — what / who / when / where / which / how many — in any language we carry? Declared
 *  interrogatives per language (the question word is a property of the language, not a model's guess). Used ONLY to let
 *  the encyclopedia answer when the open web is down; it widens nothing else. */
const FACTUAL_LATIN = /(?:^|[¿¡\s])(?:what|who|whom|whose|when|where|which|how (?:many|much|tall|high|old|long|far|big)|qué|que|cuál|cuáles|cuándo|dónde|quién|quiénes|cuánto|cuántos|cuántas|quel|quelle|quels|quelles|quand|où|qui|quoi|combien|wie|was|wer|wann|wo|welche|welcher|welches|wieviel|wie viel|qual|quais|quem|quando|onde|quanto|quantos|chi|quale|quali|dove|quanto|quanti)(?=[\s?])/iu;
const FACTUAL_CAPLESS = /什么|谁|哪|何时|什么时候|多少|几个|是不是|在哪|何|誰|いつ|どこ|どの|どれ|いくつ|что|кто|когда|где|какой|какая|какие|сколько|ما |ما$|من |متى|أين|كم |ماذا|كيف|क्या|कौन|कब|कहाँ|कितना|कितने|कैसे/iu;
// a question mark settles it only in a script whose question words are not in the list above (any non-Latin letter)
const NON_LATIN_Q = /[^\u0000-\u024f]/u;
export function factualAsk(question) {
  const q = String(question ?? "").trim();
  if (!q || q.length > 240) return false;
  return FACTUAL_LATIN.test(q.slice(0, 80)) || FACTUAL_CAPLESS.test(q) || (NON_LATIN_Q.test(q) && /[?？؟]/.test(q));
}

export function routeSources(question, { only = null, lang = "en" } = {}) {
  const q = String(question ?? "");
  const why = { web: "always — the open web is the one source that answers anything" };
  const picked = new Set(["web"]);
  for (const [key, spec] of Object.entries(AFFINITY)) {
    let reason = null;
    for (const [re, r] of spec.cues) if (re.test(q)) { reason = r; break; }
    if (reason) for (const s of expand(key)) { picked.add(s); why[s] = reason; }
  }
  // The cues above are English. A plain factual ask in another language reads the encyclopedia in ITS language
  // (the caller names the edition it detected); an English ask keeps the cue rules exactly as they were.
  if (lang !== "en" && !picked.has("wikipedia") && factualAsk(q)) { picked.add("wikipedia"); why.wikipedia = `a factual ask in another language (${lang}) — its own Wikipedia`; }
  let scopes = ALL.filter((s) => picked.has(s));
  if (only) scopes = scopes.filter((s) => only.includes(s));
  return { scopes, why, rest: ALL.filter((s) => !scopes.includes(s)) };
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/**
 * Step 2 — let the web results vote for specialists not already chosen.
 * A source needs the votes of at least `quorum` results (default 2 of the top
 * 10) so one stray link doesn't drag in a whole API.
 * @returns { add: [scopes], why: { scope: reason } }
 */
export function probeSources(webResults, chosen = [], { quorum = 2, top = 10 } = {}) {
  const have = new Set(chosen);
  const votes = new Map(), reason = new Map();
  for (const r of (Array.isArray(webResults) ? webResults : []).slice(0, top)) {
    const h = hostOf(r && r.url);
    for (const [re, key, why] of HOST_VOTES) if (re.test(h)) { votes.set(key, (votes.get(key) || 0) + 1); reason.set(key, why); }
  }
  const add = [], why = {};
  for (const [key, n] of votes) {
    if (n < quorum) continue;
    for (const s of expand(key)) if (!have.has(s)) { add.push(s); why[s] = `${reason.get(key)} (${n} of top ${top})`; }
  }
  return { add, why };
}

// A source that answered 429 is left alone for a while. Module-level so every
// turn in the tab shares it; the clock is injectable for tests.
const cooldown = new Map();
export const COOLDOWN_MS = 60_000;
export function noteRateLimited(scope, now = Date.now()) { cooldown.set(scope, now + COOLDOWN_MS); }
export function coolingDown(scope, now = Date.now()) {
  const until = cooldown.get(scope);
  if (until == null) return false;
  if (now >= until) { cooldown.delete(scope); return false; }
  return true;
}
export function resetCooldowns() { cooldown.clear(); }
export const isRateLimitError = (e) => /\b429\b|limiting|rate/i.test(String((e && e.message) || e || ""));
