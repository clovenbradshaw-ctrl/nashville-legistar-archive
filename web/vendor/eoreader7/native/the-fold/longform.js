// longform.js — a PIECE asked for by its length (P108). Pure.
//
// "Write me a 30-page essay on the X-Files" is not a question; it is work
// with a declared size. The signal read here is the COUNTED property (P4):
// a length — pages or words — stated in the ask. No list of document kinds
// decides anything: the noun the length modifies ("essay", "report",
// "memo", whatever it is) is carried as `kind` for the record, never used
// to admit or refuse. The topic is what follows the ask's own "on"/"about"
// after the length phrase, or the remainder when neither is present.

export const WORDS_PER_PAGE = 500;          // a manuscript page (giver: the common editorial convention)
export const WORDS_PER_SECTION = 650;       // what one ~1,100-token draft yields on a small mouth (measured 2026-09-05, gemma2:2b)
export const PART_TOKENS = 1100;
export const MAX_SECTIONS = 40;
export const MIN_SECTIONS = 4;

const LENGTH_RE = /\b(\d{1,3}(?:,\d{3})?)\s*[- ]?\s*(pages?|words?|pg)\b(?:\s+(?:long\s+)?([a-z][a-z-]*))?/i;
const WRITE_RE = /\b(write|draft|compose|produce|author|prepare)\b/i;

/**
 * detectLongForm(question) → { pages, words, sections, kind, topic } or null.
 * Requires a writing verb AND a stated length; the length decides the size.
 */
export function detectLongForm(question) {
  const q = String(question ?? "").trim();
  if (!q || q.startsWith("/")) return null;
  if (!WRITE_RE.test(q)) return null;
  const m = q.match(LENGTH_RE);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2].toLowerCase();
  const words = unit.startsWith("w") ? n : n * WORDS_PER_PAGE;
  const pages = unit.startsWith("w") ? Math.max(1, Math.round(n / WORDS_PER_PAGE)) : n;
  const kind = m[3] && !/^(on|about|regarding|covering|for|of|that|which|to)$/i.test(m[3]) ? m[3].toLowerCase() : null;
  const after = q.slice(m.index + m[0].length);
  const topicMatch = after.match(/\b(?:on|about|regarding|covering)\s+(.+)$/is) ?? q.match(/\b(?:on|about|regarding|covering)\s+(.+)$/is);
  let topic = (topicMatch ? topicMatch[1] : after).trim().replace(/[.!?\s]+$/g, "").trim();
  // A page address in the ask is the named-source path's business (P23); it is not the topic.
  topic = topic.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  if (!topic) return null;
  const sections = Math.max(MIN_SECTIONS, Math.min(MAX_SECTIONS, Math.round(words / WORDS_PER_SECTION)));
  return { pages, words, sections, kind, topic };
}

/** The task handed to the planner: the ask restated with its declared size, so the plan is sized by a number and not by appetite. */
export function longFormTask({ pages, sections, kind, topic }) {
  const piece = kind ?? "piece";
  return `Write a ${pages}-page ${piece} on ${topic}. Plan it as exactly ${sections} sections in reading order — an introduction first, a conclusion last, and between them the distinct movements of one argument; each section is a few words of label and one sentence of what it must establish. Each section is then written as continuous prose of about ${WORDS_PER_SECTION} words, in its own voice, without lists or headings inside it.`;
}

// ---------------------------------------------------------------------
// A PROGRAM ASKED FOR BY ITS SHAPE (Pass 30). The counted property here is
// the spec: a building verb, a runtime the terminal's own registry names
// (the caller passes `runtimes` — term.js's ROSTER keys, a declared
// registry, never a list typed here), and the features the ask enumerates
// after "that"/"which"/":" — each clause a part to build.
const BUILD_RE = /\b(write|build|make|create|code|implement|program)\b/i;
const ALIASES = Object.freeze({ javascript: "js", node: "js", py: "python", python3: "python", sqlite: "sql", rb: "ruby" });

/** The clause split alone — a spec's own sentences, each a part to build.
 *  Pulled out of detectCodePiece so a caller that already has an explicit
 *  language and a free-text spec (the Coding pane's own composer, which
 *  does not need the build-verb/runtime-word heuristic below at all) can
 *  reuse the identical split rather than a second copy of this regex. */
export function splitFeatures(spec) {
  return String(spec ?? "").split(/\s*(?:;|,\s*(?:and\s+|then\s+)?|\band then\b|\band\b)\s*/i).map((f) => f.trim()).filter((f) => f.split(/\s+/).length >= 2);
}

export function detectCodePiece(question, { runtimes = [] } = {}) {
  const q = String(question ?? "").trim();
  if (!q || q.startsWith("/")) return null;
  if (!BUILD_RE.test(q)) return null;
  const known = new Set(runtimes.map((r) => String(r).toLowerCase()));
  let lang = null;
  for (const w of q.toLowerCase().match(/[a-z][a-z0-9+#]*/g) ?? []) { const c = ALIASES[w] ?? w; if (known.has(c) && c !== "fold") { lang = c; break; } }
  if (!lang) return null;
  const specMatch = q.match(/\b(?:that|which|to|:)\s+(.+)$/is) ?? q.match(/:\s*(.+)$/s);
  const spec = (specMatch ? specMatch[1] : "").trim().replace(/[.!?\s]+$/g, "");
  if (!spec) return null;
  const features = splitFeatures(spec);
  if (!features.length) return null;
  return { lang, spec, features, parts: Math.max(2, Math.min(10, features.length)) };
}

/** A source that is CODE, by its name (P113): read by the sandbox and the declaration scout, never by the prose reader — a `.js` file read as English yields `Arokin —is→ …` notes and a cast of identifiers (measured 2026-09-05, the self-review). */
// WHAT A PASSAGE IS, NOT WHAT IT IS CALLED (P136). `.html` was in this list,
// so every passage of a rendered encyclopaedia article was classed as code
// and dropped from `prosePassages` — which is what feeds the snips, the
// obligations, the cast and the referent check. Measured: in one live run the
// Lincoln article was retrieved 439 times and was invisible to all of them.
//
// An HTML file in this instrument is always RENDERED to text before it
// becomes a passage (the long-stream driver strips tags; the web path keeps a
// text face), so by the time anything here sees it, it is prose. Raw markup
// that never got rendered is still code-like, and that is decided by looking
// at the text rather than at the name — the same discipline the referent
// check answers to: read what it IS.
const CODE_EXT = /\.(m?js|cjs|ts|tsx|jsx|py|rb|php|r|sql|json|css|sh|yml|yaml|toml)$/i;
const MARKUP_DENSE = (text) => {
  const t = String(text ?? "");
  if (!t) return false;
  const tags = (t.match(/<\/?[a-z][^>]{0,80}>/gi) ?? []).length;
  return tags > 0 && tags * 40 > t.length;   // a tag every ~40 chars is markup, not prose
};
// A recording's transcript is speech, never code, whatever its container.
export const isAudioSource = (name) => /@\d+(?:\.\d+)?-\d+(?:\.\d+)?$|\.audio$/i.test(String(name ?? ""));
export const isCodeSource = (name, text = null) =>
  !isAudioSource(name) &&
  (CODE_EXT.test(String(name ?? "").split("#")[0].split("@")[0]) || (text != null && MARKUP_DENSE(text)));

const foldT = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
/** The topic's content words, folded: every one must appear in a source for it to be in a piece's scope (P114). */
export const topicTerms = (topic) => [...new Set(foldT(topic).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2 && !/^(the|and|for|with|from|about|into|over)$/.test(w)))];

// A lightweight, in-file sentence split \u2014 this module stays PURE (no engine
// import, no injected organ), so this is a cheap approximation, never the
// real sentence-terminator/abbreviation-aware splitter (spans.js) the app
// injects into admission.js. Good enough for the company check below: real
// sentence-ending punctuation followed by a capital/digit, or a paragraph
// break, is a real boundary for ordinary prose even if it occasionally
// misjudges an abbreviation \u2014 the same trade-off admission.js's own
// `hasCompany` accepts for a caller with no sentence-splitter injected,
// just resolved the OTHER way (a permissive fallback there; a cheap real
// splitter here, since `inScope` has no "omit and stay permissive" option
// without losing the fix entirely).
const roughSentences = (text) => String(text ?? "").split(/(?<=[.!?])\s+(?=[A-Z0-9])|\n{2,}/);

/**
 * In scope: a source whose text carries every content word of the topic \u2014
 * AND, once that clears, at least `need` of those words attested TOGETHER
 * in one of the source's own sentences, never merely scattered somewhere
 * across a large document (P31 "company, not bare occurrence," the same
 * principle admission.js already applies one door earlier \u2014 see that
 * file's own header). Found live, 2026-09-15, chasing a reported piece-mode
 * leak: this function's own prior "every term appears somewhere" reading
 * was confirmed the weaker of the two ("a weak raw-substring 'every term'
 * match over workspace-wide sources, structurally much weaker than
 * admission.js" \u2014 a live investigation's own words); a long, unrelated,
 * stale source can coincidentally carry every one of a short topic's own
 * words, each in a different paragraph about something else entirely.
 * `need` caps at what the topic offers (a one-word topic asks for company
 * of one, i.e. bare presence \u2014 the same floor-capping rule
 * ADMISSION_FLOOR uses), so a genuinely narrow topic is never held to an
 * impossible bar. Material attached for something else never reaches a
 * piece (measured 2026-09-05: the self-review drew a Borodino prose poem
 * from a War and Peace slice attached hours earlier).
 */
export function inScope(topic, text) {
  const terms = topicTerms(topic);
  if (!terms.length) return true;
  const f = foldT(text);
  if (!terms.every((t) => f.includes(t))) return false;
  const need = Math.min(2, terms.length);
  if (need < 2) return true;
  return roughSentences(text).some((s) => {
    const sf = foldT(s);
    return terms.filter((t) => sf.includes(t)).length >= need;
  });
}
/** The sources' own section headings: short lines with no terminal punctuation, standing alone — the outline the material already has, handed to the planner as a fact (P114). */
export function headingsOf(text, { max = 40 } = {}) {
  const out = [];
  const lines = String(text ?? "").split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i].replace(/^#+\s*/, "").trim();
    if (!l || l.length > 60) continue;
    const words = l.split(/\s+/);
    if (words.length < 1 || words.length > 7) continue;
    if (/[.!?:;,]$/.test(l) || /^\d+$/.test(l)) continue;
    const prevBlank = i === 0 || !lines[i - 1].trim();
    const nextBlank = i === lines.length - 1 || !lines[i + 1].trim();
    if (!(prevBlank && nextBlank)) continue;
    if (/^(references|external links|see also|notes|contents|navigation|edit|jump to)$/i.test(l)) continue;
    // A heading heads PROSE: the next non-blank line is a paragraph, not
    // another short line (an infobox row, a list item, a citation). Found
    // by running (2026-09-05): the Wikipedia face's "- Michael W. Watkins",
    // "Lowry 1995 , p. 257" and "Main article: …" all passed as headings and
    // the planner, handed them, collapsed to one part.
    if (/^[-*•]\s|^(main article|further information|see also):/i.test(l) || /\[\s*\d+\s*\]|\bpp?\.\s*\d/.test(l)) continue;
    let k = i + 1; while (k < lines.length && !lines[k].trim()) k += 1;
    const next = k < lines.length ? lines[k].trim() : "";
    // A saved wiki face marks each section heading with its own "[ edit ]"
    // line right after it — a structural marker of that face, not a word.
    const editMarked = /^\[\s*edit\s*\]$/i.test(next);
    if (/^\[\s*edit\s*\]$/i.test(l)) continue;
    if (!editMarked && next.length < 120) continue;
    if (!out.includes(l)) out.push(l);
    if (out.length >= max) break;
  }
  return out;
}
