// fold-chat-ground.js — the fold's grounding mechanisms, ported lean for the
// chat surface, and its per-turn RECORD in the holodeck's own voice.
//
// The fold's organs (eoreader7 native/organs: cite.js, grounding.js, source.js)
// run the full pipeline against a workspace's retrieved chunks. This surface is
// sealed-external and never touches the workspace, so the material it grounds
// against is the one it already carries: the person's OWN messages. Same
// mechanisms, reading that material:
//
//   stripSelfCitations  the model is never shown an address and never asked to
//                       cite; a bracket address in its OWN output is neutralized.
//   attribute/coverage  attach each answer sentence to the material it shares a
//                       PHRASE with (a consecutive run of >= MIN_RUN tokens),
//                       addressed to a byte range within that message, and veto
//                       the attachment if the sentence commits to a proper name
//                       the material does not contain.
//   unsupportedClaims   the figures and names in the answer the material does
//                       not say at all.
//   turnRecord          the holodeck's one-line record: addresses checked,
//                       nothing unsupported (or how many are not in the material).
//
// HOW A SENTENCE IS GROUNDED (docs/GATE-FIX-PREREG.md, measured by eval/controls.mjs): the material is cut into sentences; a claim is
// checked against a WINDOW (one sentence and one either side), chosen by how much of the claim's figures, names and content terms it
// carries. Inside the window every figure must be present (same figure, or the same quantity in another declared unit to the claim's own
// precision) and bound to the words it sits beside; a name that is not the page's subject must be present too; every content term must be
// on the page at all. Source tags ([W1]), "According to the … article", site names and markdown are stripped first. Cross-language
// sentences cannot overlap lexically: they are returned with the typed reason "cross-language", never grounded on a figure alone.
//
// It never judges whether an uncited claim is TRUE; it says what the material
// backs and what it does not. The model proposes; the record decides.

import { segments, SITE_NAMES } from "./fold-chat-mind.js";
import { FUNCTION_WORDS } from "./fold-chat-function-words.js";
import { detectLang } from "./fold-chat-lang.js";

export const MIN_RUN = 2;
// A run of shared tokens only warrants a claim if at least one token is
// SUBSTANTIVE — a content word, not a function word. Without this, two common
// words ("Washington, D.C.") anchor an unrelated "founded 1795".
const STOP_EN = ["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are", "was", "were", "be", "been", "by", "as", "at", "it", "its", "this", "that", "these", "those", "with", "from", "into", "his", "her", "their", "they", "them", "we", "you", "he", "she", "had", "has", "have", "not", "but", "also", "first", "one", "two", "new", "old", "then", "than", "when", "where", "which", "who", "will", "would", "could", "should", "said", "says", "any", "all", "some", "may", "more", "most", "other", "such", "only", "own", "same", "so", "no", "nor", "too", "very"];
// Hedges and frame verbs: words that wrap a claim without being the claim ("roughly 8,849 m", "is located in",
// "is known as"). Declared, English; another language's hedges simply count as content (an honest limit).
const HEDGE_EN = ["roughly", "officially", "formally", "widely", "commonly", "traditionally", "approximately", "approx", "nearly", "likely", "probably", "possibly", "perhaps", "apparently", "believed", "thought", "considered", "indicate", "indicates", "suggest", "suggests", "source", "sources", "article", "page", "almost", "circa", "estimated", "reportedly", "generally", "typically", "usually", "often", "really", "actually", "simply", "basically", "currently", "still", "just", "even", "ever", "about", "around", "located", "situated", "found", "known", "called", "named", "stands", "stand", "lies", "became", "become", "becomes", "made", "makes", "make", "using", "used", "uses", "being", "there", "their", "which", "while", "since", "many", "much", "well", "year", "years", "today", "currently", "overall", "namely", "indeed", "exactly"];
// Function words of every language we carry a prior for (fold-chat-function-words.js, UD-derived), folded the same way
// tokens are. The union is only ever used to say "this token carries no claim by itself".
// Marks folded away so spelling variants meet: Latin accents (U+0300-036F), Arabic tatweel and tashkeel (U+0640, U+064B-065F,
// U+0670), Hebrew niqqud (U+0591-05C7). Built from code points so the source stays readable.
const cps = (ranges) => new RegExp("[" + ranges.map(([a, b]) => String.fromCharCode(a) + (b ? "-" + String.fromCharCode(b) : "")).join("") + "]", "g");
const FOLD_MARKS = cps([[0x300, 0x36f], [0x640], [0x64b, 0x65f], [0x670], [0x591, 0x5c7]]);
const PLAIN_ASCII = /^[\x00-\x7f]*$/;
const foldWord = (t) => {
  const s = String(t);
  return PLAIN_ASCII.test(s) ? s.toLowerCase() : s.normalize("NFD").replace(FOLD_MARKS, "").normalize("NFC").toLowerCase();
};
const STOP = new Set([...STOP_EN, ...Object.values(FUNCTION_WORDS).flat().map(foldWord)]);
const HEDGE = new Set(HEDGE_EN);
const isFigure = (t) => /^\d/.test(t);
const IDEO = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const ABJAD = /^[\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}]/u;
// A content token: not a function word or hedge, and long enough to be a word in ITS script — an ideographic or Hangul
// word is 2+ characters; Arabic/Hebrew/Devanagari/Thai words are 3+; everything else 4+ (the old rule, a Latin one).
const contentToken = (t) => {
  if (!t || isFigure(t) || STOP.has(t) || HEDGE.has(t)) return false;
  if (IDEO.test(t)) return t.length >= 2;
  if (ABJAD.test(t)) return t.length >= 3;
  return t.length >= 4;
};
const substantive = (t) => (isFigure(t) ? t.length >= 4 : contentToken(t));
// A shared run anchors a claim only when it carries real content: at least TWO
// substantive tokens, at least one a word (not a bare figure). "in 2014",
// "the first", "its first", "was the first" all fail (one substantive);
// "was founded in 1857" passes (founded + 1857, one a word). This is the bar
// that stops unrelated prose from grounding a claim.
const substantiveRun = (toks) => {
  const subs = toks.filter(substantive);
  return subs.length >= 2 && subs.some((t) => !isFigure(t));
};

// A trailing token that only LOOKS like a sentence end: titles, a multi-dot
// abbreviation (D.C., U.S., a.m.), or a lone initial (J. R. R. Tolkien).
const ABBREV = /\b(?:mr|mrs|ms|dr|prof|sr|jr|st|vs|etc|no|fig|inc|ltd|co|gov|dept|approx|est|mt|ave|blvd|rd|gen|col|capt|lt|sgt|hon|rev|pres|vol|ed|pp?)\.$|(?:\b[A-Za-z]\.){2,}$|\b[A-Z]\.$/i;

/** Split an answer into sentences. A newline boundary is unconditional; only
 *  a ./!/? boundary can be an abbreviation in disguise. */
export function splitSentences(text) {
  // CJK full stops are followed by no space at all: a boundary is made after each one.
  const src = String(text ?? "").replace(/([。！？]+['"”’)\]」』]*)(?=\S)/gu, "$1\n");
  const pieces = [];
  let start = 0;
  const re = /(?<=[.!?।॥؟。！？])\s+|\n+/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const piece = src.slice(start, m.index);
    const boundaryIsSentencePunct = /[.!?]$/.test(src.slice(0, m.index));
    if (boundaryIsSentencePunct && ABBREV.test(piece.trimEnd())) continue;
    const trimmed = piece.trim();
    if (trimmed) pieces.push(trimmed);
    start = m.index + m[0].length;
  }
  const tail = src.slice(start).trim();
  if (tail) pieces.push(tail);
  const out = [];
  for (const piece of pieces) {
    if (out.length && /^\[[^\]\s]+#\d+-\d+\]/.test(piece)) out[out.length - 1] += " " + piece;
    else out.push(piece);
  }
  return out;
}

function fold(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const URL_RE = /^https?:\/\//i;
export const isUrl = (source) => URL_RE.test(String(source ?? ""));
export const domainOf = (source) => {
  if (!isUrl(source)) return null;
  try { return new URL(String(source)).hostname.replace(/^www\./, ""); } catch { return null; }
};

/** The verbatim excerpt around a byte span in the material: the SENTENCE that
 *  contains the supporting span, split so the span itself can be marked. The
 *  reader sees the sentence that supports the claim, with the exact span
 *  highlighted — never the answer sentence, never a run fragment. */
export function excerpt(text, span, { max = 240 } = {}) {
  const s = String(text ?? "");
  if (!span || span.start == null || span.end == null)
    return { before: "", mark: oneLine(s).slice(0, max), after: "", quote: oneLine(s).slice(0, max), ellipsisBefore: false, ellipsisAfter: s.length > max };
  const LOOK = 200;
  const from = Math.max(0, span.start - LOOK);
  const to = Math.min(s.length, span.end + LOOK);
  const beforeTxt = s.slice(from, span.start);
  // a sentence ends at ./!/? FOLLOWED BY SPACE (never inside "8,848.86" or "3.14"), at a CJK/Devanagari/Arabic terminator, or at a newline
  // (and never after a title or initial: "St.", "Dr.", "J.")
  const endsHere = (abs) => !(s[abs] === "." && ABBREV.test(s.slice(Math.max(0, abs - 12), abs + 1)));
  let bIdx = -1;
  for (const m of beforeTxt.matchAll(/[.!?](?=\s|$)|[。！？।॥؟]|\n/gu)) if (endsHere(from + m.index)) bIdx = m.index;
  const start = bIdx >= 0 ? from + bIdx + 1 : from;
  const afterTxt = s.slice(span.end, to);
  let aIdx = -1;
  for (const m of afterTxt.matchAll(/[.!?](?=\s|$)|[。！？।॥؟]|\n/gu)) if (endsHere(span.end + m.index)) { aIdx = m.index; break; }
  const end = aIdx >= 0 ? span.end + aIdx + 1 : to;
  let before = oneLine(s.slice(start, span.start));
  const mark = oneLine(s.slice(span.start, span.end));
  let after = oneLine(s.slice(span.end, end));
  // Hard-cap around the mark, cutting on word boundaries.
  const room = Math.max(0, max - mark.length);
  if (before.length + after.length > room) {
    const half = Math.floor(room / 2);
    before = wordTail(before, half);
    after = wordHead(after, half);
  }
  return { before, mark, after, quote: oneLine([before, mark, after].filter(Boolean).join(" ")), ellipsisBefore: start > 0, ellipsisAfter: end < s.length };
}

// Cut on word boundaries only — never mid-token.
const wordTail = (t, n) => (t.length <= n ? t : (t.slice(t.length - n).replace(/^\S*\s+/, "") || ""));
const wordHead = (t, n) => (t.length <= n ? t : (t.slice(0, n).replace(/\s+\S*$/, "") || ""));

// ---- tokens ----------------------------------------------------------------
// A token is a run of letters, marks and digits: \p{M} keeps Devanagari/Arabic vowel signs INSIDE their word, and a
// run that holds ideographic or Thai text is cut into words by Intl.Segmenter (a CJK clause is not one token).
// Diacritics are folded away (Latin accents, Arabic tashkeel, Hebrew niqqud); case is folded for every script that has it.
const WORD_RUN = /[\p{L}\p{N}\p{M}]+/gu;
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}]/u;
// Digits of other scripts become ASCII digits one for one (offsets are unchanged), so "१९४७" is a figure like "1947".
const DIGIT_ZEROS = [0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xe50, 0xf20, 0xff10];
const NON_ASCII_DIGIT = cps([[0x660, 0x669], [0x6f0, 0x6f9], [0x966, 0x96f], [0x9e6, 0x9ef], [0xa66, 0xa6f], [0xae6, 0xaef], [0xb66, 0xb6f], [0xbe6, 0xbef], [0xc66, 0xc6f], [0xce6, 0xcef], [0xd66, 0xd6f], [0xe50, 0xe59], [0xf20, 0xf29], [0xff10, 0xff19]]);
const asciiDigits = (s) => !NON_ASCII_DIGIT.test(s) ? s : s.replace(/\p{Nd}/gu, (ch) => {
  const cp = ch.codePointAt(0);
  if (cp < 128) return ch;
  for (const z of DIGIT_ZEROS) if (cp >= z && cp < z + 10) return String(cp - z);
  return ch;
});
function wordsOfRun(run) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const out = [];
    for (const x of segments(run)) out.push({ text: x.text, start: x.start, end: x.end });
    if (out.length) return out;
  }
  // No segmenter: an ideographic run falls back to one token per character (a lexical run can still be found).
  return [...run].map((ch, k) => ({ text: ch, start: k, end: k + ch.length }));
}

/** Tokens with their character offsets in the source, so a shared run can be
 *  mapped back to a real byte range. */
export function tokensWithOffsets(text) {
  const src = asciiDigits(String(text ?? ""));
  const out = [];
  for (const m of src.matchAll(WORD_RUN)) {
    const run = m[0];
    if (UNSPACED.test(run)) {
      for (const w of wordsOfRun(run)) out.push({ t: foldWord(w.text), start: m.index + w.start, end: m.index + w.end });
    } else out.push({ t: foldWord(run), start: m.index, end: m.index + run.length });
  }
  return out;
}

export function tokenize(text) { return tokensWithOffsets(text).map((x) => x.t); }

/** The longest run of tokens two sequences share in order. A shared word is a
 *  coincidence; a shared run is a phrase, the smallest thing that can be said
 *  to have come from somewhere. */
export function overlap(a, b) {
  const x = a || [], y = b || [];
  let prev = new Uint16Array(y.length + 1);
  let best = 0;
  for (let i = 1; i <= x.length; i++) {
    const row = new Uint16Array(y.length + 1);
    for (let j = 1; j <= y.length; j++) {
      if (x[i - 1] === y[j - 1]) { row[j] = prev[j - 1] + 1; if (row[j] > best) best = row[j]; }
    }
    prev = row;
  }
  return best;
}

/** The best aligned run of `a` inside b[from, to), with the index (in b) where it ends. When two runs tie on length the
 *  SUBSTANTIVE one wins — a run of stopwords ("its first leader") never outranks one that carries content. */
function bestRun(a, b, from = 0, to = b.length) {
  const n = to - from;
  let prev = new Uint16Array(n + 1);
  let best = 0, endJ = -1, bestSub = 0, endSub = -1;
  const subRun = (j, len) => {
    let subs = 0, hasWord = false;
    for (let k = j - len; k < j; k++) { const t = b[from + k]; if (substantive(t)) { subs++; if (!isFigure(t)) hasWord = true; } }
    return subs >= 2 && hasWord;
  };
  for (let i = 1; i <= a.length; i++) {
    const row = new Uint16Array(n + 1);
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[from + j - 1]) {
        const run = prev[j - 1] + 1;
        row[j] = run;
        if (run > best) { best = run; endJ = j; }
        if (run > bestSub && subRun(j, run)) { bestSub = run; endSub = j; }
      }
    }
    prev = row;
  }
  return bestSub >= MIN_RUN ? { score: bestSub, endJ: from + endSub, sub: true } : { score: best, endJ: endJ < 0 ? -1 : from + endJ, sub: false };
}

const ALREADY_CITED = /\[[^\]\s]+#\d+-\d+\]/g;

export function stripSelfCitations(text) {
  let removed = 0;
  const out = String(text ?? "").replace(ALREADY_CITED, () => { removed++; return "[citation removed — not issued by this instrument]"; });
  return { text: out, removed };
}

// ---- what is NOT the claim: source tags, lead-ins, source names, markdown ----
const TAG_RE = /\[\s*[WSM]?\d+\s*\]|\b[WS]\d+\b(?!\.\d)/g;
const SOURCEY = /wikipedia|article|page|source|site|website|passage|text|document|encyclop\w*|entry|report|\bW\d+\b|\[\s*[WS]\d+\s*\]/i;
const LEAD_IN = /^\s*(?:according to|per|as (?:stated|reported|noted|described|explained|written|shown) (?:by|in|on)|based on|from|drawing on|source:)\s+[^,:;]{0,90}[,:]\s*/iu;
// "The sources indicate that …", "As the source puts it, …", "Based on the sources I have, …": the writer reporting that it read, not what it read.
const SAYS = /^\s*(?:(?:the|these|those|my|your|this|that)\s+(?:[\p{L}'’-]+\s+){0,2})?(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)(?:\s+(?:I|we)\s+(?:have|read|found))?\s+(?:indicates?|shows?|says?|states?|suggests?|mentions?|notes?|reports?|confirms?|explains?|describes?|tells?|supports?|puts? it)(?:\s+(?:us|you))?(?:\s+that)?\s*[,:]?\s*|^\s*as\s+(?:the|this|that|these)\s+(?:[\p{L}'’-]+\s+){0,2}(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)\s+(?:puts? it|says?|states?|explains?|notes?|describes?)\s*[,:]?\s*|^\s*based on\s+(?:the\s+)?(?:[\p{L}'’-]+\s+){0,2}(?:sources?|passages?|articles?|pages?|documents?|texts?|results?|excerpts?|materials?)[^,:;]{0,40}[,:]\s*/iu;
const TRAIL_SRC = /[,;]?\s*(?:according to|as (?:stated|reported|noted) (?:by|in)|per)\s+(?:the\s+)?(?:\[?[WS]\d+\]?|sources?|articles?|pages?)[^.!?]*(?=[.!?]?$)/iu;
// what is left of a trailing "according to [W2]" once the tag is gone
const TRAIL_EMPTY = /[,;]?\s*(?:according to|as (?:stated|reported|noted) (?:by|in)|per)\s*[.!?]*\s*$/iu;
const TRAIL_SAYS = /[,;]?\s*(?:the|this|that|my)\s+(?:[\p{L}'’-]+\s+)?(?:sources?|reports?|articles?|pages?|passages?|texts?|documents?|studies|study|data|material)\s+(?:says?|states?|notes?|reports?|indicates?|shows?|suggests?|explains?|adds?)\W*$/iu;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SITE_LIST = [...SITE_NAMES].map((n) => n.toLowerCase());
const SITE_RE = new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...SITE_NAMES].sort((a, b) => b.length - a.length).map(escRe).join("|")})(?![\\p{L}\\p{N}])`, "giu");
/** A claim without the packaging the writer wrapped it in: leaked [W1]/W2 tags, "According to the … article,", the names
 *  of the sites it was read from, markdown emphasis. What is left is what the material must carry. */
export function claimOf(text, extraSiteNames = []) {
  // a list item's bold label ("* **Historical records:** …") names the item, it is not part of the claim
  let s = String(text ?? "").replace(/^\s*[*\-•]\s*\*\*[^*\n]{1,60}:\*\*\s*/u, "").replace(/[*_`#>]+/g, " ").replace(TAG_RE, " ");
  const lead = s.match(LEAD_IN);
  if (lead && SOURCEY.test(lead[0])) s = s.slice(lead[0].length);
  s = s.replace(SAYS, "").replace(TRAIL_SRC, "").replace(TRAIL_EMPTY, "").replace(TRAIL_SAYS, "").replace(/^[\s"'“”‘’>-]+|[\s"'“”‘’]+$/gu, "");
  const low = s.toLowerCase();
  if (SITE_LIST.some((n) => low.includes(n))) s = s.replace(SITE_RE, " ");
  for (const n of extraSiteNames) s = s.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escRe(n)}(?![\\p{L}\\p{N}])`, "giu"), " ");
  return s.replace(/\s+/g, " ").trim();
}
// the second-level label of each source host ("britannica" from www.britannica.com) is a source name too
const hostLabel = (source) => {
  try { const h = new URL(String(source)).hostname.replace(/^www\./, "").split("."); const l = h.length > 1 ? h[h.length - 2] : h[0]; return l.length >= 5 && !/^wikipedia$/i.test(l) ? l : null; } catch { return null; }
};

// ---- names ----
const NAME_RUN_RE = /(?<![\p{L}\p{N}_])(\p{Lu}[\p{L}\p{N}_.'-]*(?:\s+\p{Lu}[\p{L}\p{N}_.'-]*)+)(?<=[\p{L}\p{N}_])/gu;
const ACRONYM_RE = /(?<![\p{L}\p{N}_])(\p{Lu}{2,})(?![\p{L}\p{N}_])/gu;
// A single capitalized word — a lone proper noun (Washington, Ottawa, Canberra, Brasília). It may end the sentence
// ("…is located in London.": the full stop is not part of the name, only a full stop before another letter is, as in "U.S.").
const LONE_NAME_RE = /(?<![\p{L}\p{N}_.'-])(\p{Lu}[\p{L}\p{N}_'-]+)(?![\p{L}\p{N}_'-])(?!\.[\p{L}\p{N}])/gu;
const COMMON_CAP = new Set(["The", "A", "An", "In", "On", "At", "Of", "For", "To", "And", "But", "Or", "It", "Its", "This", "That", "These", "Those", "When", "Where", "Which", "Who", "Why", "How", "As", "By", "From", "With", "His", "Her", "Their", "They", "We", "You", "He", "She", "If", "So", "Then", "There", "Here", "Today", "Tomorrow", "Yesterday", "It's", "There's", "However", "Meanwhile", "Also", "Both", "Each", "Every", "Some", "Most", "Many", "After", "Before", "During", "Between", "Under", "Over", "Now", "Once", "Yet", "Thus", "Hence", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  // sentence openers of the other languages we answer in: interrogatives and articles are not names
  "Qué", "Cuál", "Cuáles", "Cómo", "Cuándo", "Dónde", "Quién", "Por", "El", "La", "Los", "Las", "Un", "Una", "Es", "Según", "Quel", "Quelle", "Quels", "Quelles", "Comment", "Quand", "Où", "Qui", "Quoi", "Pourquoi", "Le", "Les", "Une", "Des", "Du", "Selon", "Wie", "Was", "Wer", "Wann", "What", "Whose", "Whom", "Based", "Note", "Así", "Entonces", "Donc", "Dann", "Wo", "Warum", "Welche", "Welcher", "Welches", "Der", "Die", "Das", "Ein", "Eine", "Es", "Laut", "Qual", "Quais", "Quem", "Quando", "Onde", "Porque", "Como", "O", "Os", "As", "Um", "Uma", "Segundo", "Quale", "Dove", "Perché", "Il", "Lo", "Gli", "Wat", "Waar", "Wanneer", "Waarom", "Het", "Een"]);

// openers that start a sentence capitalised but name nothing ("According to…", "However,…")
for (const w of ["According", "However", "Although", "Because", "While", "After", "Before", "Since", "During", "If", "Yet", "Also", "Some", "Many", "Most", "Other", "Others", "Such", "Each", "Every", "Both", "Several", "Overall", "Instead", "Meanwhile", "Furthermore", "Moreover", "Additionally", "Despite", "Unlike", "Like", "Following", "Through", "Within", "Without", "Between", "Today", "Here", "There", "Their", "They", "We", "Our", "His", "Her", "She", "He", "Yes", "No", "Not"]) COMMON_CAP.add(w);

/** The names a sentence commits to: runs of >= 2 capitalized words, bare
 *  acronyms, and LONE proper nouns (a capitalized word that is not a common
 *  opener). This is what lets "founded in 1795" be checked against a passage
 *  lacking Washington/Ottawa — a lone subject capital IS a name. Only scripts
 *  with capital letters have these; Han, Kana, Arabic, Devanagari … carry no name veto (an honest gap). */
export function namesIn(text) {
  const s = claimOf(text);
  const names = new Set();
  const taken = []; // spans already consumed by a name-run or acronym
  for (const m of s.matchAll(NAME_RUN_RE)) { names.add(m[1]); taken.push([m.index, m.index + m[0].length]); }
  for (const m of s.matchAll(ACRONYM_RE)) { names.add(m[1]); taken.push([m.index, m.index + m[0].length]); }
  const inTaken = (i) => taken.some(([a, b]) => i >= a && i < b);
  for (const m of s.matchAll(LONE_NAME_RE)) {
    const w = m[1];
    if (COMMON_CAP.has(w)) continue;         // an opener, not a name
    if (inTaken(m.index)) continue;          // already part of a name-run
    if (/^[A-Z][a-z]?$/.test(w)) continue;   // a lone initial, not a name
    names.add(w);
  }
  return [...names];
}

// A name's tokens, without the articles that a capitalised run can swallow ("The Eiffel Tower").
const nameParts = (n) => {
  const all = tokenize(n).filter((p) => p.length > 1);
  const core = all.filter((p) => !STOP.has(p));
  return core;   // a "name" made only of function words ("What I", "The") is a sentence opener, not a name
};

// ---- figures and units ----
// A SMALL DECLARED conversion table (dimension, factor to the base unit, spellings). Spellings are folded like tokens.
const UNIT_TABLE = [
  ["len", 1, ["m", "metre", "metres", "meter", "meters", "metro", "metros", "mètre", "mètres", "metr", "метр", "метра", "метров", "米", "公尺", "متر", "مترا", "أمتار", "امتار", "मीटर", "メートル", "미터"]],
  ["len", 1000, ["km", "kilometre", "kilometres", "kilometer", "kilometers", "kilómetro", "kilómetros", "kilomètre", "kilomètres", "километр", "километра", "километров", "км", "公里", "千米", "كيلومتر", "किलोमीटर", "キロメートル", "キロ"]],
  ["len", 0.01, ["cm", "centimetre", "centimetres", "centimeter", "centimeters", "厘米", "公分"]],
  ["len", 0.3048, ["ft", "foot", "feet", "pie", "pies", "pied", "pieds", "pé", "pés", "fuß", "fuss", "фут", "футов", "英尺", "قدم", "फ़ीट", "फीट"]],
  ["len", 1609.344, ["mi", "mile", "miles", "milla", "millas", "mille", "milles", "meile", "meilen", "миля", "миль", "英里", "ميل", "मील"]],
  ["mass", 1, ["kg", "kilogram", "kilograms", "kilogramme", "kilogrammes", "kilo", "kilos", "公斤", "千克"]],
  ["mass", 0.001, ["g", "gram", "grams", "gramme", "grammes"]],
  ["mass", 0.45359237, ["lb", "lbs", "pound", "pounds", "libra", "libras", "livre", "livres", "磅"]],
];
const UNITS = new Map();
for (const [dim, f, words] of UNIT_TABLE) for (const w of words) UNITS.set(foldWord(w), { dim, f, w: foldWord(w) });
const UNIT_WORDS = [...UNITS.keys()].sort((a, b) => b.length - a.length);
const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th|s)?\b/g;
export function numbersIn(text) {
  const out = new Set();
  for (const m of asciiDigits(String(text ?? "")).matchAll(NUMBER_RE)) out.add(m[0].replace(/,/g, "").toLowerCase());
  return [...out];
}
/** The figures of a text, with where they are and which unit (if any) they carry. */
function figuresIn(text, base = 0) {
  const src = asciiDigits(String(text ?? ""));
  const out = [];
  for (const m of src.matchAll(NUMBER_RE)) {
    const norm = m[0].replace(/,/g, "").toLowerCase();
    const end = m.index + m[0].length;
    const rest = foldWord(src.slice(end, end + 16).replace(/^\s?/, ""));
    let unit = null;
    for (const w of UNIT_WORDS) {
      if (!rest.startsWith(w)) continue;
      const nx = rest.slice(w.length, w.length + 1);
      if (UNSPACED.test(w) || !nx || !/[\p{L}\p{N}²³]/u.test(nx)) { unit = UNITS.get(w); break; }
    }
    const numeric = /^\d[\d.]*$/.test(norm);
    const dec = numeric && norm.includes(".") ? norm.length - norm.indexOf(".") - 1 : 0;
    out.push({ raw: m[0], norm, v: numeric ? parseFloat(norm) : NaN, dec, numeric, unit, start: base + m.index, end: base + end });
  }
  return out;
}
const nearFig = (v, c) => Math.abs(v - c.v) <= 0.5 * Math.pow(10, -c.dec) + 1e-9 * Math.abs(c.v);
/** Does window figure w say what claim figure c says? The same figure; the same quantity in another declared unit
 *  (330 m = 1,082.68 ft = 0.33 km), to the precision the CLAIM states; or the claim's rounding of a decimal (8,849 for 8,848.86). */
function figureMatches(c, w) {
  if (c.norm === w.norm) return true;
  if (!c.numeric || !w.numeric) return false;
  if (c.unit && w.unit) return c.unit.dim === w.unit.dim && nearFig(w.v * w.unit.f / c.unit.f, c);
  if (w.dec > c.dec) return Number(w.v.toFixed(c.dec)) === c.v;
  return false;
}

// ---- the material, indexed once per call ----
const STEM_RE = /^[a-z]+$/;
// The irregular English verbs a claim and its source commonly use in different forms ("fell" / "fall", "wrote" / "written").
// A small declared table, not a stemmer for other languages (they match on the exact word, an honest limit).
const IRREGULAR = Object.fromEntries(Object.entries({
  fall: "fell fallen", rise: "rose risen", begin: "began begun", write: "wrote written", build: "built", become: "became", hold: "held",
  take: "took taken", give: "gave given", lead: "led", win: "won", fly: "flew flown", see: "saw seen", go: "went gone", make: "made",
  know: "knew known", find: "found", bear: "bore born borne", die: "died", lose: "lost", send: "sent", stand: "stood", sit: "sat",
  speak: "spoke spoken", choose: "chose chosen", break: "broke broken", drive: "drove driven", ride: "rode ridden", teach: "taught",
  buy: "bought", sell: "sold", pay: "paid", say: "said", tell: "told", think: "thought", bring: "brought", come: "came", run: "ran",
  leave: "left", meet: "met", keep: "kept", grow: "grew grown", draw: "drew drawn", throw: "threw thrown", sing: "sang sung", swim: "swam swum",
}).flatMap(([base, forms]) => forms.split(" ").map((f) => [f, base])));
const stemOf = (t) => {
  if (!STEM_RE.test(t)) return t;
  if (IRREGULAR[t]) return IRREGULAR[t];
  if (t.length < 5) return t;
  const r = t.replace(/(?:ing|ed|es|ly|s|e)$/, "");
  return r.length >= 4 ? r : t;
};
// The gate's own figure/unit/stem machinery, offered to fold-chat-assemble.js (the backward path) so it reads figures and units
// EXACTLY as the gate does; nothing here changes what the gate does.
export { figuresIn, figureMatches, stemOf, COMMON_CAP };
export const unitOfWord = (w) => UNITS.get(foldWord(String(w ?? ""))) || null;
const SENT_END = /[.!?]+["')\]]*\s+|[。！？।॥؟]+["')\]]*\s*|\n+/gu;
function sentenceStarts(text) {
  const starts = [0];
  for (const m of text.matchAll(SENT_END)) {
    const end = m.index + m[0].length;
    if (end >= text.length) break;
    if (/^[.!?]/.test(m[0])) {
      const from = starts[starts.length - 1];
      if (ABBREV.test(text.slice(from, m.index + m[0].trimEnd().length).trimEnd())) continue;
    }
    starts.push(end);
  }
  return starts;
}
function indexMaterial(m) {
  const text = String(m.text || "").slice(0, 20000);
  const toks = tokensWithOffsets(text);
  const plain = toks.map((x) => x.t);
  const starts = sentenceStarts(text);
  const nS = starts.length;
  const sentOfOffset = (off) => { let lo = 0, hi = nS - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; } return lo; };
  const sentOf = new Int32Array(toks.length), first = new Int32Array(nS).fill(-1), last = new Int32Array(nS).fill(-1);
  const sets = Array.from({ length: nS }, () => new Set());
  const all = new Set();
  for (let i = 0; i < toks.length; i++) {
    const si = sentOfOffset(toks[i].start);
    sentOf[i] = si;
    if (first[si] < 0) first[si] = i;
    last[si] = i;
    const t = plain[i], st = stemOf(t);
    sets[si].add(t); sets[si].add(st); all.add(t); all.add(st);
  }
  const figs = figuresIn(text);
  const figsBySent = Array.from({ length: nS }, () => []);
  for (const f of figs) figsBySent[sentOfOffset(f.start)].push(f);
  // capitalised in the middle of a sentence on this page = the page treats it as a name
  const topic = new Set(tokenize(`${m.ref || ""} ${(() => { try { return decodeURIComponent(new URL(String(m.source)).pathname.split("/").pop() || "").replace(/[_-]/g, " "); } catch { return ""; } })()}`));
  const tokAt = (off) => { let lo = 0, hi = toks.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (toks[mid].start < off) lo = mid + 1; else hi = mid; } return lo; };
  return { ...m, text, toks, plain, starts, nS, sentOf, sentAt: sentOfOffset, first, last, sets, all, figs, figsBySent, topic, tokAt };
}

// ---- language gap (typed, never faked) ----
const EN_FUNCTION = new Set(FUNCTION_WORDS.en.map(foldWord));
function languageGap(claim, offered) {
  try {
    const a = detectLang(claim);
    if (!a.confident) {
      // A short Latin-script sentence the detector cannot name (la/de are French AND Spanish) is still not English when it
      // holds six or more words and not one of them is an English function word, and the source is confidently English.
      const toks = tokenize(claim);
      if (a.script !== "Latin" || toks.length < 6 || toks.some((t) => EN_FUNCTION.has(t))) return null;
      for (const m of offered) { const b = (m.lang ||= detectLang(String(m.text).slice(0, 1500))); if (b.confident && b.lang === "en") return { from: "unknown", to: "en" }; }
      return null;
    }
    for (const m of offered) {
      const b = (m.lang ||= detectLang(String(m.text).slice(0, 1500)));
      if (!b.confident) continue;
      if (a.script !== b.script || a.lang !== b.lang) return { from: a.lang, to: b.lang };
    }
  } catch { /* detection is advisory */ }
  return null;
}

const BIND_NEIGHBOURS = 3, BIND_GRACE = 3, MIN_EVIDENCE = 2;
const hasStem = (sets, t) => sets.some((s) => s.has(t));
// Words that only REPORT a measurement beside the measurement ("stands 330 m high", "reaches a height of 330 m"): the
// unit fixes the dimension, so which of these words is used (high / tall / height) is not the claim. They are not
// content terms; instead the window must carry SOME word of the family in the figure's own clause ("5,000 m tall" is
// not "base camps above 5,000 m"). Declared, English, and only ever applied next to a figure that carries a unit.
const QUANT_WORDS = new Set(["reach", "reaches", "reached", "reaching", "measure", "measures", "measured", "measuring", "rise", "rises", "rose", "span", "spans", "extend", "extends", "weigh", "weighs", "cover", "covers", "high", "tall", "long", "wide", "deep", "thick", "heavy", "higher", "highest", "taller", "tallest", "longer", "longest", "wider", "widest", "deeper", "deepest", "thicker", "thickest", "heavier", "heaviest", "height", "length", "width", "depth", "weight", "altitude", "elevation", "distance", "size"]);
const QUANT_LIST = [...QUANT_WORDS];
// A clause ends at a comma, semicolon, colon, dash, or the end of a sentence (brackets are transparent: "330 m (1,083 ft) tall"); the comma or point INSIDE a figure ('8,848.86') is not one.
const CLAUSE_BREAK = /[,;:—.!?\n]/;
const SENTENCE_BREAK = /[.!?\n]/;
const clauseBreak = (gap, before, after) => CLAUSE_BREAK.test(gap) && !(/^[,.]$/.test(gap) && /\d$/.test(before) && /^\d/.test(after));

/** Analyse a claim sentence into what the material must carry. */
function analyse(text, siteNames, midCaps) {
  const clean = claimOf(text, siteNames);
  const toks = tokensWithOffsets(clean);
  const figsAll = figuresIn(clean);
  // "Apollo 11", "Boeing 747": a short figure right after a capitalised word is part of the NAME, not a quantity.
  const nameFigs = [], figs = [];
  for (const f of figsAll) {
    const pre = clean.slice(0, f.start).match(/(\p{Lu}[\p{L}'’-]+)\s+$/u);
    if (pre && !COMMON_CAP.has(pre[1]) && /^\d{1,3}$/.test(f.norm) && !f.unit) nameFigs.push({ parts: [foldWord(pre[1]), f.norm], fig: f });
    else figs.push(f);
  }
  const figIdx = new Set(figsAll.map((f) => f.norm));
  // names: strict (window or topic) vs a sentence-opening lone word the page never capitalises (page-level, as it always was)
  const sentenceStartWord = (clean.match(/^\s*(\p{Lu}[\p{L}\p{N}_'-]+)/u) || [])[1];
  const names = [];
  for (const n of namesIn(clean)) {
    const parts = nameParts(n);
    if (!parts.length) continue;
    const opener = parts.length === 1 && sentenceStartWord && n === sentenceStartWord;
    names.push({ n, parts, loose: !!(opener && midCaps && !midCaps.has(foldWord(n))) });
  }
  for (const nf of nameFigs) {
    const k = names.findIndex((x) => x.parts[0] === nf.parts[0]);
    if (k >= 0) names[k] = { n: names[k].n + " " + nf.fig.norm, parts: [...names[k].parts, nf.fig.norm], loose: false };
    else names.push({ n: nf.parts.join(" "), parts: nf.parts, loose: false });
  }
  const nameTok = new Set(names.flatMap((x) => x.parts));
  // content terms: not a figure, not part of a name, not a function word or hedge, not a word that only reports a measurement
  const unitWords = new Set(figsAll.filter((f) => f.unit).map((f) => f.unit.w));
  const quantish = new Set();
  for (const f of figsAll) if (f.unit) {
    const fi = toks.findIndex((t) => t.start >= f.start);
    for (let j = Math.max(0, fi - 4); j < Math.min(toks.length, fi + 6); j++) if (QUANT_WORDS.has(toks[j].t) || QUANT_WORDS.has(stemOf(toks[j].t))) quantish.add(j);
  }
  const K = [], kIdx = new Map(), nIdx = new Map(); // token index -> stem, for content terms / for name parts
  toks.forEach((tk, i) => {
    if (nameTok.has(tk.t) && !STOP.has(tk.t)) nIdx.set(i, stemOf(tk.t));
    if (!contentToken(tk.t) || nameTok.has(tk.t) || unitWords.has(tk.t) || figIdx.has(tk.t) || quantish.has(i)) return;
    const st = stemOf(tk.t);
    kIdx.set(i, st);
    if (!K.includes(st)) K.push(st);
  });
  return { clean, toks, figs, names, K, kIdx, nIdx, quant: quantish.size > 0, plain: toks.map((x) => x.t) };
}

/** The claim's nearest content words beside a token range (within the same clause), as stems. */
function neighboursOf(a, ci, cj, withNames, topic) {
  const near = [];
  const take = (j, from, to) => {
    if (j < 0 || j >= a.toks.length) return false;
    const between = j < ci ? a.clean.slice(a.toks[j].end, a.toks[from].start) : a.clean.slice(a.toks[to].end, a.toks[j].start);
    if (CLAUSE_BREAK.test(between)) return false;
    // the page's own subject (its title's words, capitalised or not) is usually written "it" / "the tower" beside the evidence, so it is never a neighbour to look for
    const st = topic && topic.has(a.plain[j]) ? undefined : (a.kIdx.get(j) ?? (withNames ? a.nIdx.get(j) : undefined));
    if (st && !near.includes(st)) near.push(st);
    return true;
  };
  let left = true, right = true;
  for (let d = 1; d < 10 && near.length < BIND_NEIGHBOURS && (left || right); d++) {
    if (left) left = take(ci - d, ci, cj) || (ci - d >= 0 && false);
    if (right && near.length < BIND_NEIGHBOURS) right = take(cj + d, ci, cj);
  }
  return near;
}
/** The window's tokens that stand in the same clause as page token p, plus BIND_GRACE either side. */
function aroundToken(ix, p, lo, hi) {
  const out = new Set();
  const add = (j) => { if (ix.sentOf[j] < lo || ix.sentOf[j] > hi) return false; out.add(ix.plain[j]); out.add(stemOf(ix.plain[j])); return true; };
  add(p);
  for (const dir of [-1, 1]) {
    let prev = p, grace = 0, inClause = true;
    for (let j = p + dir; j >= 0 && j < ix.plain.length; j += dir) {
      const [ta, tb] = dir < 0 ? [j, prev] : [prev, j];
      const gap = ix.text.slice(ix.toks[ta].end, ix.toks[tb].start);
      if (clauseBreak(gap, ix.plain[ta], ix.plain[tb])) { if (SENTENCE_BREAK.test(gap)) break; inClause = false; }   // a sentence end stops the walk outright; a comma or bracket only starts the grace
      if (!inClause && ++grace > BIND_GRACE) break;
      if (!add(j) || Math.abs(j - p) > 40) break;
      prev = j;
    }
  }
  return out;
}

/** Do the words of a name stand within a few tokens of each other, in order, inside the window? */
function standsTogether(ix, lo, hi, parts) {
  const first = parts[0], last = parts[parts.length - 1];
  for (let k = lo; k <= hi; k++) {
    for (let j = ix.first[k]; j >= 0 && j <= ix.last[k]; j++) {
      if (ix.plain[j] !== first && stemOf(ix.plain[j]) !== first) continue;
      for (let q = j + 1; q <= Math.min(ix.last[k], j + parts.length + 2); q++) if (ix.plain[q] === last || stemOf(ix.plain[q]) === last) return true;
    }
  }
  return false;
}

/** Does this window carry the claim? Figures, names, content terms — all read in the SAME window (the sentence the span
 *  sits in, and one sentence either side), never anywhere on the page. Returns { ok, why, detail, weight }. */
function verify(a, ix, i) {
  const lo = Math.max(0, i - 1), hi = Math.min(ix.nS - 1, i + 1);
  const sets = []; const wf = [];
  for (let k = lo; k <= hi; k++) { sets.push(ix.sets[k]); for (const f of ix.figsBySent[k]) wf.push(f); }
  // 1. figures, each one placed in the window
  const matched = new Map();
  for (const c of a.figs) {
    const hits = wf.filter((w) => figureMatches(c, w));
    if (!hits.length) return { ok: false, why: "figure", detail: c.raw };
    matched.set(c, hits);
  }
  // 1b. a figure belongs with the words it sits beside: at least half of the claim's nearest content words must sit in the
  // figure's own clause in the window ("landed … July 16" is not "launched … July 16")
  for (const c of a.figs) {
    const ci = a.toks.findIndex((t) => t.start >= c.start);
    if (ci < 0) continue;
    let cj = ci; while (cj + 1 < a.toks.length && a.toks[cj + 1].start < c.end) cj++;
    const near = neighboursOf(a, ci, cj, true, ix.topic);
    if (!near.length) continue;
    const need = Math.ceil(near.length / 2);
    const ok = matched.get(c).some((w) => { const around = aroundToken(ix, ix.tokAt(w.start), lo, hi); return near.filter((t) => around.has(t)).length >= need; });
    if (!ok) return { ok: false, why: "figure-binding", detail: c.raw };
  }
  // 1c. a measurement phrase ("stands … high") needs a word of that family where the figure is
  if (a.quant && !a.figs.some((c) => matched.get(c).some((w) => { const around = aroundToken(ix, ix.tokAt(w.start), lo, hi); return QUANT_LIST.some((q) => around.has(q)); }))) return { ok: false, why: "figure-binding", detail: "measurement" };
  // 2. names: in the window, or the page's own subject (its title); a multi-word name needs its surname in the window
  let nameEvidence = 0;
  for (const nm of a.names) {
    if (nm.loose) { if (!nm.parts.every((p) => ix.all.has(p))) return { ok: false, why: "name", detail: nm.n }; continue; }
    const inWin = nm.parts.map((p) => hasStem(sets, p));
    const topic = nm.parts.every((p) => ix.topic.has(p));
    const whole = inWin.every(Boolean);
    const partial = nm.parts.length >= 2 && inWin[inWin.length - 1] && nm.parts.every((p) => ix.all.has(p));
    if (!(whole || topic || partial)) return { ok: false, why: "name", detail: nm.n };
    if (!(whole || partial)) continue;
    // a multi-word name counts as evidence only where its words stand together ("Steve Jobs"), not scattered over a window
    if (nm.parts.length >= 2 && !standsTogether(ix, lo, hi, nm.parts)) continue;
    nameEvidence += nm.parts.filter((p, k) => inWin[k]).length >= 2 ? 2 : 1;
    // 2b. a name that is NOT the page's subject is bound to the words it sits beside, in its own sentence ("Sydney … capital")
    if (topic) continue;
    const last = nm.parts[nm.parts.length - 1];
    let ci = -1; for (let j = 0; j < a.plain.length; j++) if (a.plain[j] === last) { ci = j; break; }
    if (ci < 0) continue;
    // only a word the window HAS but not beside this name is a cross-wiring signal; a word the window lacks is the terms check's business
    const near = neighboursOf(a, ci, ci, false, ix.topic).filter((t) => hasStem(sets, t));
    if (!near.length) continue;
    const need = 1;
    const withName = []; for (let k = lo; k <= hi; k++) if (ix.sets[k].has(last)) withName.push(k);
    if (withName.length && !withName.some((k) => near.filter((t) => ix.sets[k].has(t)).length >= need)) return { ok: false, why: "name-binding", detail: nm.n };
  }
  // 3. content terms: a term no source says at all is something the writer added; a claim whose terms mostly sit elsewhere is not this window's
  const absent = a.K.filter((t) => !ix.all.has(t));
  if (absent.length) return { ok: false, why: "terms", detail: absent.slice(0, 3).join(", ") };
  const inWinK = a.K.filter((t) => hasStem(sets, t));
  if (a.K.length >= 3 && inWinK.length / a.K.length < 0.34) return { ok: false, why: "terms-elsewhere", detail: a.K.filter((t) => !inWinK.includes(t)).slice(0, 3).join(", ") };
  const evidence = a.figs.length + nameEvidence + inWinK.length;
  if (evidence < MIN_EVIDENCE) return { ok: false, why: "thin", detail: "" };
  return { ok: true, weight: evidence };
}

/** Attribute each sentence of an answer to the material it came from. `material`
 *  is [{ ref, label, text }] where `ref` is the display name and `label` the
 *  short source tag (S1, S2). Returns [{ text, ref, source, span, score, why }];
 *  `ref`/`span` are null when the sentence is not grounded, and `why` says in a
 *  typed word where the check failed. */
export function attribute(answer, material = []) {
  if (!material.length) return [];
  // Bound the work: attribution is synchronous in the browser tab, so neither
  // the answer nor each passage may be unbounded. 20k chars of material per
  // source is far more than any sentence needs to match against. Everything
  // about a passage (tokens, sentences, figures) is built ONCE and reused for
  // every sentence.
  const offered = material.map(indexMaterial);
  const siteNames = offered.map((m) => hostLabel(m.source)).filter(Boolean);
  const midCaps = new Set();
  for (const m of offered) for (const x of m.text.matchAll(/(?<=[\p{Ll}\d,;:)]\s)(\p{Lu}[\p{L}'’-]+)/gu)) midCaps.add(foldWord(x[1]));
  const sentences = splitSentences(answer).slice(0, 80);
  return sentences.map((text) => {
    const a = analyse(text, siteNames, midCaps);
    const itemsN = a.figs.length + a.names.length + a.K.length;
    const miss = (why, detail = "", score = 0) => {
      const gap = languageGap(a.clean, offered);
      return { text, ref: null, source: null, span: null, score, why: gap ? "cross-language" : why, detail, ...(gap ? { gap } : {}) };
    };
    if (!itemsN) return miss("no-content");
    // candidate windows: every sentence of every passage, scored by how much of the claim its neighbourhood carries
    const cands = [];
    for (const m of offered) {
      for (let i = 0; i < m.nS; i++) {
        let score = 0, hit = 0;
        for (let k = Math.max(0, i - 1); k <= Math.min(m.nS - 1, i + 1); k++) {
          const own = k === i ? 1.5 : 1;
          for (const f of a.figs) if (m.figsBySent[k].some((w) => figureMatches(f, w))) { score += 3 * own; hit++; }
          for (const nm of a.names) { const h = nm.parts.filter((p) => m.sets[k].has(p)).length; if (h) { score += 2 * own * h / nm.parts.length; hit++; } }
          for (const t of a.K) if (m.sets[k].has(t)) { score += own; hit++; }
        }
        if (hit) cands.push({ m, i, score });
      }
    }
    if (!cands.length) return miss("no-overlap");
    cands.sort((x, y) => y.score - x.score);
    let firstFail = null, nearFail = null, ok = null;
    for (const c of cands.slice(0, 8)) {
      const v = verify(a, c.m, c.i);
      if (v.ok) { ok = { ...c, v }; break; }
      if (!firstFail) firstFail = v;
      // the failure of the passage that got FURTHEST: its names and figures held and only content terms were missing. Reporting the first failure of
      // ANY passage lets a film page's missing "English" mask the novel page that says it ("a novel by English author Jane Austen"), and the
      // caller's frame-word rescue (the ask's own "wrote" is not on the page) only runs for a `terms` failure.
      if (!nearFail && (v.why === "terms" || v.why === "terms-elsewhere" || v.why === "thin")) nearFail = v;
    }
    if (!ok) { const f = nearFail || firstFail; return miss(f.why, f.detail, 0); }
    // the cited span: the best run of the claim inside the window's best sentence, else the evidence's own extent
    const { m, i } = ok;
    const lo = Math.max(0, i - 1), hi = Math.min(m.nS - 1, i + 1);
    const carries = (k) => { let n = 0; for (const f of a.figs) if (m.figsBySent[k].some((w) => figureMatches(f, w))) n += 3; for (const nm of a.names) n += nm.parts.filter((p) => m.sets[k].has(p)).length; for (const t of a.K) if (m.sets[k].has(t)) n++; return n; };
    let bestK = i; for (let k = lo; k <= hi; k++) if (carries(k) > carries(bestK)) bestK = k;
    const from = m.first[bestK], to = m.last[bestK] + 1;
    // the quote the reader is shown is the sentence the span sits in, so the span is searched in the sentence that carries the evidence only
    const run = from >= 0 ? bestRun(a.plain, m.plain, from, to) : { score: 0, endJ: -1, sub: false };
    let startTok, endTok;
    if (run.sub && run.score >= MIN_RUN) { startTok = m.toks[run.endJ - run.score]; endTok = m.toks[run.endJ - 1]; }
    else {
      // no phrase in common: the span is where the matched figures and names sit in the sentence
      const set = new Set([...a.figs.map((f) => f.norm), ...a.names.flatMap((x) => x.parts), ...a.K]);
      let s0 = -1, e0 = -1;
      for (let j = from; j < to && j >= 0; j++) if (set.has(m.plain[j]) || set.has(stemOf(m.plain[j]))) { if (s0 < 0) s0 = j; e0 = j; }
      if (s0 < 0 || e0 - s0 > 40) { s0 = from; e0 = Math.min(to - 1, from + 11); }
      startTok = m.toks[s0]; endTok = m.toks[e0];
    }
    const span = { start: startTok.start, end: endTok.end };
    return { text, ref: m.ref, source: m.source, span, address: `${m.ref}#${span.start}-${span.end}`, score: run.sub ? run.score : ok.v.weight, sourceText: m.text, window: { from: m.starts[lo], to: hi + 1 < m.nS ? m.starts[hi + 1] : m.text.length } };
  });
}

export function coverage(answer, material = []) {
  const entries = attribute(answer, material);
  const grounded = entries.filter((e) => e.ref);
  const refs = [...new Set(grounded.map((e) => e.address))];
  return { entries, grounded: grounded.length, total: entries.length, refs, ratio: entries.length ? grounded.length / entries.length : 0 };
}

/** The checkable claims the material does NOT support. A figure counts as said when the material says it, or says the
 *  same quantity in another declared unit / with more decimals (see figureMatches); source tags and the names of the
 *  sites an answer cites are not claims. */
export function unsupportedClaims(answer, material = []) {
  const hayFigs = [];
  const hayToks = new Set();
  for (const m of material) {
    const t = String(m?.text ?? "");
    for (const f of figuresIn(t)) hayFigs.push(f);
    for (const x of tokenize(t)) hayToks.add(x);
  }
  const exact = new Set(hayFigs.map((f) => f.norm));
  const extra = hayFigs.filter((f) => f.numeric && (f.unit || f.dec > 0));
  const numbers = [];
  for (const c of figuresIn(claimOf(answer))) {
    if (exact.has(c.norm) || extra.some((w) => figureMatches(c, w))) continue;
    if (!numbers.includes(c.norm)) numbers.push(c.norm);
  }
  const names = namesIn(answer).filter((name) => {
    const parts = nameParts(name);
    return parts.length > 0 && !parts.every((p) => hayToks.has(p));
  });
  return { numbers, names };
}

/** The typed note for sentences that are in another language than every source: the gate compares WORDING, and wording
 *  cannot cross a language. It says so; it does not translate, and it does not call the sentence wrong. */
export function languageGapNote(gaps) {
  const list = Array.isArray(gaps) ? gaps : [];
  if (!list.length) return "";
  const pair = list[0].from && list[0].to ? ` (${list[0].from} against sources in ${list[0].to})` : "";
  return `⟂ fold: ${list.length === 1 ? "1 sentence is" : list.length + " sentences are"} in a different language than the sources${pair}. The fold checks wording against the sources, so it cannot check ${list.length === 1 ? "it" : "them"} — that is a gap in the check, not a finding that ${list.length === 1 ? "it is" : "they are"} wrong.`;
}

/** The full per-turn RECORD, holodeck-shaped: what was addressed, what is not
 *  in the material, the ungrounded sentences, and the one-line record. */
export function turnRecord(answer, material = [], { turn = 1, question = "", model = "", sealed = false } = {}) {
  const has = material.length > 0 && material.some((m) => String(m?.text ?? "").trim().length >= 40);
  const cov = has ? coverage(answer, material) : { entries: [], grounded: 0, total: splitSentences(answer).length, refs: [], ratio: 0 };
  const uns = has ? unsupportedClaims(answer, material) : { numbers: [], names: [] };
  // Addressed sources, deduped by address.
  const seen = new Set();
  const sources = [];
  for (const e of cov.entries) {
    if (!e.address || seen.has(e.address)) continue;
    seen.add(e.address);
    sources.push({ address: e.address, ref: e.ref, span: e.span, text: e.text });
  }
  const ungrounded = cov.entries.filter((e) => !e.ref).map((e) => e.text);
  // sentences the gate could not check because they are in another language than every source (a typed gap, never a silent miss)
  const gaps = cov.entries.filter((e) => !e.ref && e.why === "cross-language").map((e) => ({ kind: "cross-language", text: e.text, from: e.gap?.from || null, to: e.gap?.to || null }));
  const bad = [...uns.numbers, ...uns.names];
  const bits = [
    nbOrd(cov.refs.length, "address", "addresses") + " checked",
    bad.length ? bad.length + " not in the material" : "nothing unsupported",
    cov.total - cov.grounded > 0 ? (cov.total - cov.grounded) + " sentence(s) ungrounded" : "every sentence grounded",
    ...(gaps.length ? [gaps.length + " in another language than the sources (not checkable by wording)"] : []),
  ];
  const line = has
    ? `On record · turn ${turn} · ${bits.join(" · ")}`
    : `On record · turn ${turn} · no material carried · the answer stands on the model alone`;
  // The facing page rides the record when material was read (never over a
  // greeting): the spread the surface renders.
  const facing = has ? facingPage(answer, material) : { sources: [], response: [], has: false };
  // examined: the panel is shown ONLY when the fold actually read material
  // (the holodeck's lesson — a grounding report over nothing is noise, and a
  // greeting is not a claim). A materialless turn carries examined:false and
  // the surface renders no panel at all.
  return { turn, hasMaterial: has, examined: has, coverage: cov, unsupported: uns, sources, ungrounded, gaps, facing, line };
}

const nbOrd = (n, a, b) => n + " " + (n === 1 ? a : (b || a + "s"));

/** The facing page: the turn as a book spread (the holodeck's own construction,
 *  ported lean). LEFT are the SOURCES — each cited passage numbered S1, S2, …
 *  by first use, carrying the verbatim sentence read from the real material and
 *  its permanent address (ref#byteStart-byteEnd). RIGHT is the RESPONSE — every
 *  sentence tagged [S#] to the passage it draws from, or [M] for the mouth's own
 *  prose (ungrounded). Nothing is re-summarized: the snip is the material's own
 *  bytes and the tags are the turn's own attributions, laid side by side.
 *  Returns { sources, response, has }. */
export function facingPage(answer, material = []) {
  const entries = attribute(answer, material);
  const fnum = new Map();
  for (const e of entries) if (e.ref && !fnum.has(e.address)) fnum.set(e.address, fnum.size + 1);
  const cites = new Map();
  for (const e of entries) if (e.ref) cites.set(e.address, (cites.get(e.address) || 0) + 1);
  const sources = [...fnum.entries()].map(([address, n]) => {
    const e = entries.find((x) => x.address === address);
    const ex = excerpt(e?.sourceText, e?.span);
    return {
      n: "S" + n, address, ref: e?.ref ?? null, span: e?.span ?? null,
      // Identity tokens for a source-faithful card (label · domain · url).
      label: e?.ref ?? null, source: e?.source ?? null,
      url: isUrl(e?.source) ? e.source : null,
      domain: domainOf(e?.source),
      // The verbatim material sentence around the span, split so the span is
      // marked; `text` is the whole sentence for a quick read.
      text: ex.quote || String(e?.text ?? "").trim(),
      before: ex.before, mark: ex.mark, after: ex.after,
      ellipsisBefore: ex.ellipsisBefore, ellipsisAfter: ex.ellipsisAfter,
      cite: cites.get(address) || 0,
    };
  });
  const response = entries.map((e) => ({
    tag: e.ref && fnum.has(e.address) ? "S" + fnum.get(e.address) : "M",
    text: String(e.text ?? "").trim(),
    grounded: !!(e.ref && fnum.has(e.address)),
    address: e.ref ? e.address : null,
  }));
  return { sources, response, has: sources.length > 0 };
}

/** THE FALSIFY PASS — the adversarial re-check of the attribution, run when the
 *  fold thinks deep. A grounded entry is only STRONG when its shared run is a
 *  long, content-bearing anchor (>= 4 tokens); a 2–3 token run is a WEAK anchor
 *  and is demoted — never shown as settled. Returns a verdict per sentence and
 *  the counts, so the fold can name exactly what survived and what did not. */
export function falsify(entries = []) {
  const out = [];
  let supported = 0, weak = 0, unsupported = 0;
  for (const e of entries) {
    if (!e.ref) { unsupported++; out.push({ text: e.text, verdict: "unsupported" }); continue; }
    if ((e.score || 0) >= 4) { supported++; out.push({ text: e.text, ref: e.ref, verdict: "supported" }); }
    else { weak++; out.push({ text: e.text, ref: e.ref, verdict: "weak" }); }
  }
  return { checked: out.length, supported, weak, unsupported, entries: out };
}

/** The fold-voice note appended under an answer that overreached — what the
 *  material does not say, named. */
export function ungroundedNote(unsupported) {
  const parts = [];
  if (unsupported.numbers.length) parts.push(`figures ${unsupported.numbers.slice(0, 6).join(", ")}`);
  if (unsupported.names.length) parts.push(`names ${unsupported.names.slice(0, 6).join(", ")}`);
  if (!parts.length) return "";
  return `⟂ fold: the material here does not say ${parts.join("; ")} — not grounded in what you gave me.`;
}

/** A mechanical one-line gist for the record (System 1 style): the answer's
 *  first sentence, clipped. Never a claim about truth, only a fold of the text. */
export function foldLine(question, answer) {
  const s = splitSentences(answer).find((x) => x.length > 12) || String(answer || "").trim();
  const clip = s.replace(/\s+/g, " ").trim().slice(0, 160);
  return clip ? (clip.length < s.length ? clip + "…" : clip) : "";
}

/** The sources of a facing page, grouped by DOCUMENT in first-seen order. One
 *  document read once supplies several passages (S1, S2, S3 …); the surface lists
 *  the document once with its passages under it. A passage keeps its own S# tag. */
export function sourceDocs(sources) {
  const m = new Map();
  for (const src of Array.isArray(sources) ? sources : []) {
    const key = src.url || src.source || src.label || src.ref || src.n;
    if (!m.has(key)) m.set(key, { title: src.label || src.ref || "source", domain: src.domain || "", url: src.url || null, passages: [] });
    m.get(key).passages.push(src);
  }
  return [...m.values()];
}
