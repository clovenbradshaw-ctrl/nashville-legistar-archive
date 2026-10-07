// kernel/register.js — THE REGISTER (Halliday): a request is read for its
// FIELD (what staged social process is being invoked), TENOR (who it is
// for), and MODE (the medium it is carried in). There is NO hardcoded
// "essay mode" — an essay is one genre among many, registered the same way
// a story or a nocturne is. The pipeline is ONE: read → stage → feel →
// write → satisfy. The genre's STAGING (the sequence of phases and
// transitions) comes from the sidecar's accumulated knowledge when the genre
// has been seen before, else from the record's own seams — never from a
// hardcoded branch.
//
// Handle: Halliday — after M.A.K. Halliday, Systemic Functional Linguistics:
// "learning how to mean"; genre = staged, goal-oriented social process
// (Martin on Halliday); register = field/tenor/mode. A genre is a staging,
// and a staging is learned, not declared.

export const REGISTER_SCHEMA = "EORegister@1";

// ── FIELD: what staged process the request invokes. The recognition set is
// OPEN, not a closed list: the map registers known genre-nouns to their
// field; anything unknown falls to the generic staged pipeline (staging
// derived from the record's own seams). Adding a genre is registering a
// noun, never writing a new branch.
// A web platform named by its kind ("make a reddit for dolphins", "build a
// forum for gardeners") is a site to build — the build door, the instrument
// register and the language reader all read this one list, set by hand
// 2026-09-27 after "make a reddit but only for dolphin content" was answered
// as chat. ("blog" is left out: "a blog post" is prose.)
export const WEB_PLATFORM_NOUNS = Object.freeze(["reddit", "subreddit", "forum", "message board", "wiki"]);
const FIELD_BY_NOUN = {
  story: "narrative", "short story": "narrative", tale: "narrative", fiction: "narrative", novel: "narrative",
  essay: "exposition", article: "exposition", paper: "exposition", report: "exposition", brief: "exposition", guide: "exposition", "write-up": "exposition",
  poem: "lyric", sonnet: "lyric", villanelle: "lyric", haiku: "lyric", ode: "lyric", verse: "lyric",
  song: "music", "piece of music": "music", sonata: "music", nocturne: "music", etude: "music", symphony: "music", tune: "music", melody: "music",
  code: "instrument", script: "instrument", program: "instrument", function: "instrument",
  tool: "instrument", cli: "instrument", application: "instrument", app: "instrument", module: "instrument", library: "instrument", package: "instrument", service: "instrument", server: "instrument", api: "instrument", class: "instrument", utility: "instrument", component: "instrument",
  website: "instrument", webpage: "instrument", "web page": "instrument", "web app": "instrument", "web site": "instrument", homepage: "instrument", site: "instrument", "landing page": "instrument", html: "instrument", css: "instrument",
};
const NOUN_RE = /\b(?:short story|piece of music|write-up|[a-z]+)\b/gi;
const KNOWN = Object.keys(FIELD_BY_NOUN);

// ── CODE SIGNAL: a request that names code by EXTENSION or by code-shape
// vocabulary (def/import/class/function/CLI/endpoint) is an instrument even
// when no registered noun matched ("write a word counter in Python" has no
// noun in the table). Disclosed as a received sign, never a silent guess.
const CODE_SIGNAL = /\b(?:python|javascript|typescript|node|bash|shell|golang|rust|html|css|website|webpage)\b|\.(?:py|js|mjs|cjs|ts|tsx|sh|go|rs|html?|css)\b|\b(?:def|class|function|argparse|cli|command-?line|endpoint|stdin|stdout)\b/i;

// The instrument artifact's LANGUAGE, read off the request's own words — an
// extension, a language name, or a code-shape keyword. Same open-table
// discipline as FIELD_BY_NOUN: the language is a received sign, never a
// default. null when the request names none (the instrument voice then stays
// language-neutral and the caller picks a safe default, disclosed).
const LANG_BY_SIGNAL = [
  // Explicit language names FIRST — they win over the generic web/app shape.
  [/\.py\b|python|python3/i, "python"],
  [/\.(tsx?)\b|typescript/i, "typescript"],
  [/\.(js|mjs|cjs|jsx)\b|javascript|node(?:\.js)?\b/i, "javascript"],
  [/\.sh\b|bash|shell|zsh/i, "shell"],
  [/\.go\b|golang/i, "go"],
  [/\.rs\b|rust/i, "rust"],
  [/\.css\b|css/i, "css"],
  // The web shape LAST: a user-facing "app", "site", or "page" with no explicit
  // language is an HTML web app (the default for data-holding UI).
  [/\.html?\b|html|website|webpage|web\s*page|web\s*app|webapp|landing\s*page|dashboard|front-?end|\bapp\b|\bpage\b|\bui\b/i, "html"],
];
// The platform noun the request asks to make: a making verb opens the ask
// and the platform is its object ("make a reddit", "build me a forum"),
// read in words, no pattern.
const MAKING = new Set(["make", "build", "create", "generate", "code", "design"]);
// "I need a page where …", "we want a board for …" — asking for a thing to be made
const WANTING = new Set(["need", "want", "like"]);
/** Things a person asks to have made that are pages to use, not prose to
 *  read — set by hand 2026-09-27 from the build battery's own misses
 *  ("a sign-up page", "a lost and found board", "a tracker where I log …"). */
export const BUILD_TARGET_NOUNS = Object.freeze(["page", "board", "tracker", "dashboard", "portal"]);
export function madePlatform(task = "") {
  const words = String(task ?? "").toLowerCase().split(" ").map((w) => w.split("").filter((c) => c.toLowerCase() !== c.toUpperCase() || c === "-").join("")).filter(Boolean);
  let start = words[0] === "please" ? 1 : words[0] === "lets" || words[0] === "let's" ? 1 : 0;
  if ((words[start] === "i" || words[start] === "we") && WANTING.has(words[start + 1])) start += 1;
  const bare = words[start] === "a" || words[start] === "an";   // "a forum for people who restore old bicycles"
  if (!MAKING.has(words[start]) && !WANTING.has(words[start]) && !bare) return null;
  // the object: the first few words after the verb ("a", "me a", "an", "a simple")
  const window = words.slice(bare ? start : start + 1, start + 7);
  const at = window.findIndex((w) => WEB_PLATFORM_NOUNS.includes(w) || BUILD_TARGET_NOUNS.includes(w));
  if (at < 0) return null;
  // "a page about the Romans" / "a page on photosynthesis" / "a page of notes" is prose
  if (["about", "on", "of", "explaining", "describing"].includes(window[at + 1])) return null;
  // a bare noun phrase must name a web platform itself, not just "a page"
  if (bare && !WEB_PLATFORM_NOUNS.includes(window[at])) return null;
  return window[at];
}
export function detectLanguage(task = "") {
  const t = String(task ?? "");
  for (const [re, lang] of LANG_BY_SIGNAL) if (re.test(t)) return lang;
  // a web platform named by its kind is a web page (checked last: an explicit
  // language still wins — "a forum in python" is python)
  if (madePlatform(t)) return "html";
  return null;
}

export function deriveField(task = "", { genres = [], isFunctionWord = null } = {}) {
  const t = String(task ?? "").toLowerCase();
  for (const noun of KNOWN) {
    const m = new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).exec(t);
    if (!m) continue;
    const field = FIELD_BY_NOUN[noun];
    // THE PHRASE, NOT JUST THE MATCHED NOUN (2026-09-25): a modifier
    // immediately touching the matched noun can be a lexicalized compound
    // this table was never told about — "white paper" is not "a paper
    // that is white", the exact gap this file's own test suite once named
    // and stepped around rather than fixed. The SAME gate
    // candidateFormToken (void-spec.js) already uses: isFunctionWord
    // decides free modifier from determiner, never a hand-typed compound
    // list, so "an essay"/"a sonnet" are untouched (determiners) while
    // "white paper"/"short story" keep their real modifier. The FIELD this
    // table returns is unchanged — there is no more specific field to give
    // it without inventing one, a real, separately-named open gap — but
    // the NOUN reported is now the phrase actually asked for.
    // isFunctionWord is INJECTED, never imported here: this kernel module
    // stays pure and dependency-free (pos-prior.js is Node-only and lives
    // in the-fold, which depends on kernel, never the other way — its own
    // header already says callers that must stay pure take its answers as
    // an optional predicate). Without it, this phrase step is skipped and
    // behavior is byte-identical to before.
    const before = t.slice(0, m.index).trim().split(/\s+/).pop();
    const phrase = isFunctionWord && before && /^[a-z']+$/.test(before) && !isFunctionWord(before) ? `${before} ${noun}` : noun;
    // HOLMES (SIG): the sign is recognized — but is it LEARNED from the
    // meaning potential, or RECEIVED from the standing table? A genre the
    // sidecar has actually read is a learned sign; a noun with no reading
    // behind it is a received prior, disclosed as such — never a read.
    const learned = genres.some((g) => String(g ?? "").toLowerCase().includes(field.toLowerCase()));
    const language = field === "instrument" ? detectLanguage(task) : null;
    return {
      field, noun: phrase, language,
      provenance: learned ? "learned" : "received",
      basis: learned
        ? `"${phrase}" → ${field}: the sidecar has ${field} reading(s), so the sign is LEARNED from the meaning potential`
        : `"${phrase}" → ${field}: a received sign — the machine has not read this ${field} yet${phrase !== noun ? ` (matched table entry "${noun}"; "${phrase}" is the fuller phrase actually asked for, not yet its own registered sign)` : ""}`,
    };
  }
  // A web platform is an instrument only when the ask is to MAKE one: "make
  // a reddit for dolphins" is a build; "tell me about reddit" and "an essay
  // about reddit" are not (the platform is then the topic, not the artifact).
  const platform = madePlatform(t);
  if (platform) {
    return {
      field: "instrument", noun: platform, language: detectLanguage(task) ?? "html",
      provenance: "received",
      basis: `"${platform}" → instrument: a web platform the request asks to make — a received sign`,
    };
  }
  // Code signal fallback — a request that names code by shape, not by noun.
  if (CODE_SIGNAL.test(t)) {
    const language = detectLanguage(task);
    return {
      field: "instrument", noun: null, language,
      provenance: "received",
      basis: `code signal (${language ? `${language}, ` : ""}no registered genre-noun) — the request names code by ${language ? "language" : "shape"}`,
    };
  }
  return { field: null, noun: null, provenance: "staged", basis: "no registered genre-sign — the staged pipeline falls to the record's own seams" };
}

// ── MODE: the medium the artifact is carried in. Open, from the request's
// vocabulary and the record's lens. Text is the default when no medium is
// named; a musical request routes to the midi/audio lens.
const MODE_BY_SIGNAL = [
  [/music|song|sonata|nocturne|etude|symphony|melody|tune|compose|notes? (?:on|for)/i, "midi"],
  [/image|picture|photo|painting|drawing|visual/i, "image"],
  [/video|film|footage|shot/i, "video"],
  [/audio|recording|sound/i, "audio"],
];
export function deriveMode(task = "") {
  const t = String(task ?? "");
  for (const [re, mode] of MODE_BY_SIGNAL) if (re.test(t)) return mode;
  return "text";
}

// ── TENOR: who the artifact is for — the relationship the staging enacts.
// Declared from the request's audience words; defaults to a general reader.
export function deriveTenor(task = "") {
  const t = String(task ?? "").toLowerCase();
  if (/children|kids|child/i.test(t)) return { tenor: "children", basis: "named for children" };
  if (/expert|professional|specialist/i.test(t)) return { tenor: "expert", basis: "named for experts" };
  if (/lay|general|everyone|public/i.test(t)) return { tenor: "general", basis: "named for a general audience" };
  return { tenor: "general", basis: "defaulted — no audience named" };
}

export function deriveRegister(task = "", { genres = [], isFunctionWord = null } = {}) {
  const field = deriveField(task, { genres, isFunctionWord });
  const mode = deriveMode(task);
  const tenor = deriveTenor(task);
  return Object.freeze({
    schema: REGISTER_SCHEMA, task: String(task ?? "").slice(0, 120),
    field, mode, tenor,
    basis: `${field.basis}; carried in ${mode}; ${tenor.basis}`,
  });
}

// ── STAGING QUESTION FORM: the register's FIELD shapes the question the void
// asks of a phase. An exposition asks what a thing is; a narrative asks what
// HAPPENS there. One open table, like FIELD_BY_NOUN — a genre is registered,
// never a branch.
const QUESTION_BY_FIELD = {
  narrative: (phase, topic) => `What happens at ${phase} — what changes, and how does it carry the course toward its resolution?`,
  lyric: (phase, topic) => `What is the shape of ${phase} — its images, its turn, its return?`,
  music: (phase, topic) => `What is the gesture of ${phase} — its interval, its motion, its rest?`,
  instrument: (phase, topic) => `What is ${phase} — its parts, its seams, its behavior?`,
  exposition: (phase, topic) => `What is ${phase}, and how does it relate to ${topic}?`,
};
export function questionFor(register, phase, topic = "the subject") {
  const f = register?.field?.field;
  return (QUESTION_BY_FIELD[f] ?? QUESTION_BY_FIELD.exposition)(String(phase ?? ""), String(topic ?? "the subject"));
}

// ── WRITE VOICE: the register's FIELD shapes not only the question but the
// prose. An exposition argues (thesis → why it matters); a narrative SHOWS
// (a scene in motion — never a claim, never a meta-commentary on its own
// writing). One open table, like FIELD_BY_NOUN — a genre is registered,
// never a branch.
const VOICE_BY_FIELD = {
  narrative: {
    opening: (topic) => `We're writing a story on ${topic}. ${topic} is the world; the piece is a story set in it.\n\nOPEN THE STORY IN MEDIAS RES: drop the reader into a place and a moment — the light, the keeper, the sea — using the material's own names, places, and details, but TOLD AS A SCENE: someone is there, something is happening, the senses are engaged. No thesis, no "why this matters", no commentary about writing. Ground every concrete detail in what the material holds.`,
    body: (topic) => `WRITE THIS AS A SCENE IN THE STORY: what happens here, who acts, what changes, what the character sees and feels. Ground it in the material's real names, places, and figures, told as narrative prose with motion and tension. Do NOT analyze the chapter's title, the writing, the question, or the material itself — SHOW the moment. Continue the story already told, transition from it, do not restate it.`,
  },
  exposition: {
    opening: (topic) => `OPEN THE PIECE WITH A THESIS: a single, definite, surprising claim about ${topic} that the reader would not expect — a position, never a description. It must be grounded in what the material holds (a real fact or relation), but stated as an argument: something someone could disagree with. Then in 1-2 sentences, name why the claim matters. This is the opening of the piece itself — no introduction, no "in this essay", no commentary about writing.`,
    body: (topic) => `Now answer this part as a substantial passage of the piece itself. ANSWER WITH THE MATERIAL'S OWN FACTS about ${topic}: its real names, places, numbers, and relationships as the sources state them. Do not discuss the essay, the writing, the question, or the material itself. It continues what the piece has already established — build on it, transition from it, do not restate it.`,
  },
  // INSTRUMENT (code): the mouth emits SOURCE CODE, not prose. This is a
  // fallback voice — the proxy builds the code prompt directly (language,
  // part, the code-so-far), but any path that reaches writeVoiceFor with an
  // instrument register must not fall back to the essay voice.
  instrument: {
    opening: (topic) => `WRITE ONLY SOURCE CODE for ${topic}: the file's header and imports. Emit code only — no explanation, no prose, no markdown fences.`,
    body: (topic) => `WRITE ONLY SOURCE CODE for ${topic}: this part of the file. Emit code only — no explanation, no prose, no markdown fences — composing with the parts already written.`,
  },
  // LYRIC (poem/sonnet/haiku/villanelle/ode/verse): the mouth writes VERSE,
  // never an argument about its subject. This voice used to be undeclared,
  // so a poem ask silently fell back to the exposition voice below — "OPEN
  // WITH A THESIS… ANSWER WITH THE MATERIAL'S OWN FACTS" — which is why a
  // "write me a sonnet about dolphins" ask came back as a cited paragraph of
  // dolphin facts: the mouth was doing exactly what it was told, and what it
  // was told was an essay's instructions. The form itself (how many lines,
  // what meter, what rhyme) is whatever the person actually named — this
  // voice states the discipline, never the specific form, so it serves a
  // sonnet and a haiku and an ode alike (the open-table rule: a genre is
  // registered, never a branch).
  lyric: {
    opening: (topic) => `Write ONLY the poem itself, about ${topic}, in the exact form you were asked for (its line count, its meter, its rhyme scheme are the whole discipline — honor them precisely). No thesis, no argument, no citation, no title unless the form itself is titled, no explanation before or after. Let images and turns carry the meaning; state nothing as a claim.`,
    body: (topic) => `Continue the poem about ${topic} in the same form and voice already begun. No explanation, no restating what a poem is, no commentary about the writing — only the next lines.`,
  },
  // MUSIC (song/sonata/nocturne/etude/symphony): a mouth with no instrument
  // describes the piece in prose — its gesture and motion, never an argument
  // about the subject it is named for.
  music: {
    opening: (topic) => `Describe ONLY the piece of music itself, named for ${topic} — its gesture, its movement, its instrumentation, its turns. No thesis, no argument about ${topic}, no citation, no explanation before or after.`,
    body: (topic) => `Continue describing the piece named for ${topic} in the same voice already begun. No explanation, no commentary about the writing — only the next passage.`,
  },
};
export function writeVoiceFor(register, topic = "the subject") {
  const f = register?.field?.field;
  return VOICE_BY_FIELD[f] ?? VOICE_BY_FIELD.exposition;
}

/**
 * voiceIsDeclaredFor(register) → does THIS field have its own voice here, or
 * is it falling through to the exposition default?
 *
 * The caller needs the difference because a discovered framing may only be
 * ADDITIVE (2026-09-21, measured). Asked "what makes a good exposition — its
 * arc, its felt releases, its tension", a 2b mouth answers with story
 * structure, because those are story questions; the framing it recorded for
 * exposition says "Introduce the protagonist and their world" and, before
 * that, "never a thesis" — while the declared exposition voice below says
 * OPEN THE PIECE WITH A THESIS. A layer above the base may buy precision; it
 * may never contradict the base. So a discovered voice fills a field that has
 * none and stands aside for a field that has one.
 */
export function voiceIsDeclaredFor(register) {
  const f = register?.field?.field;
  return !!(f && Object.prototype.hasOwnProperty.call(VOICE_BY_FIELD, f));
}

// ── STAGING: the genre's phases-and-transitions. The sidecar's accumulated
// knowledge wins when the genre has been seen; else the record's own seams;
// the essay's classical form is ONE registered genre in the sidecar, never a
// branch. `staging` is a list of phases; `transitions` between them.
export function stagingFor(register, { sidecar = null, record = null, outline = null } = {}) {
  const f = register?.field?.field;
  // 1. the sidecar: has this genre been seen? its movements ARE the staging.
  if (sidecar?.entries?.length && f) {
    const seen = sidecar.entries.filter((e) => e.genre === f || e.field === f || (e.subgenre ?? "").includes(f));
    if (seen.length) {
      const moves = seen.flatMap((e) => e.movements ?? []);
      const foci = [...new Set(moves.map((m) => m.focus).filter(Boolean))].slice(0, 7);
      return { from: "sidecar", genre: f, seen: seen.length, phases: foci, basis: `the sidecar has ${seen.length} ${f} reading(s); their movements are the staging` };
    }
  }
  // 2. the record: the generic staged pipeline — the record's own seams.
  if (outline?.phases?.length) return { from: "record", genre: f ?? "staged", seen: 0, phases: outline.phases.map((p) => p.focus), transitions: outline.phases.slice(1).map((p) => p.transition), basis: `no ${f ?? "registered"} genre in the sidecar — staged from the record's own seams` };
  // 3. nothing: a declared single artifact, staged by the reader as it goes.
  return { from: "fallback", genre: f ?? "staged", seen: 0, phases: [], basis: "no sidecar knowledge, no record — the artifact is staged as it is written" };
}