// fold-chat-book.js — read a WHOLE BOOK the fold has on its shelf (the ethos corpus), instead of the web.
//
// When an ask names a book on the shelf, the fold fetches the complete text once (cached for the tab), splits it
// into Book / Chapter / paragraph with character offsets, finds the people the ask names (by how often each word of
// the ask appears capitalized in the book itself — no hand list), and keeps the paragraphs where they ALL appear.
// A "from X's perspective / through X's eyes" ask names a FOCAL person: paragraphs that narrate that person's inner
// life (felt, thought, seemed to her …) rank higher. One best paragraph per chapter, the strongest few, back in story
// order: those are the passages the answer must stand on, each addressed as "Book Six, Chapter XVI · chars a–b".
//
// Pure except load(), which fetches. Node-testable with an injected text.

const SHELF = [
  {
    id: "war-and-peace", title: "War and Peace", author: "Leo Tolstoy", translator: "Louise and Aylmer Maude",
    match: /\bwar\s+(?:and|&)\s+peace\b/i,
    url: "https://raw.githubusercontent.com/scores-patch-points/Zenodotus/main/11-multi-language/war-and-peace/en/pg2600_War_and_Peace_Tolstoy_Maude.txt",
    home: "https://www.gutenberg.org/ebooks/2600", via: "ethos · Project Gutenberg 2600",
  },
];
export const bookFor = (q) => SHELF.find((b) => b.match.test(String(q || ""))) || null;

// A BOOK ASK: the person named a book the fold holds WHOLE. `content` is true when the ask asks for what is IN it —
// read it, summarize it, the plot, the story, what happens, the themes — in which case the fold reads it and narrates.
// A bare mention ("war and peace?") is not yet a content ask: the fold offers the two ways it could go.
const CONTENT_ASK_RE = /\b(read|summari[sz]e|summary|synopsis|recap|tl;?dr|gist|plot|story|premise|theme|themes|character|characters|protagonist|what happens|what happened|explain|describe|tell me|analyse|analyze|analys|review|overview|walk me|spoil|beginning|ending|moral)\b/i;
export function bookAsk(question) {
  const book = bookFor(question);
  if (!book) return null;
  return { book, content: CONTENT_ASK_RE.test(deaccent(String(question || ""))) };
}
/** What the fold says when it could either read the book or search the web for what people say — its own words. */
export function bookOffer(book) {
  return `I hold the whole text of ${book.title} by ${book.author}, so I can read it and tell you what happens, or search online and see what people say about it. Which would you like?`;
}

const deaccent = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const TITLES = new Set(["prince", "princess", "count", "countess", "lord", "lady", "sir", "madame", "monsieur", "mademoiselle", "general", "emperor", "tsar", "king", "queen"]);
const STOP = new Set("the and but for with from that this what when where which who whom whose why how explain tell about plot story give show describe summary summarize analysis analyse analyze perspective point view eyes voice told book novel chapter war peace into onto their there they them then than through also just only very more most".split(" "));
const INTERIOR = /\b(?:she|her)\s+(?:felt|thought|knew|wanted|wished|feared|remembered|understood|loved|could not|did not know)\b|\bseemed to her\b|\bher heart\b|\bher soul\b/gi;
const ORD = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5, SIX: 6, SEVEN: 7, EIGHT: 8, NINE: 9, TEN: 10, ELEVEN: 11, TWELVE: 12, THIRTEEN: 13, FOURTEEN: 14, FIFTEEN: 15 };
const cap = (w) => w.charAt(0) + w.slice(1).toLowerCase();

const cache = new Map();
/** Fetch and parse the whole text once per tab. */
export async function load(book, { fetchImpl = fetch } = {}) {
  if (cache.has(book.id)) return cache.get(book.id);
  const p = (async () => {
    const r = await fetchImpl(book.url);
    if (!r.ok) throw new Error(`${book.title}: HTTP ${r.status}`);
    return parse(await r.text());
  })();
  cache.set(book.id, p);
  p.catch(() => cache.delete(book.id));
  return p;
}

/** Book / Chapter / paragraph, each paragraph with its character offsets in the raw text.
 *  `text` is the raw text itself, kept for the mechanical fold (fold-chat-bookfold.js). */
export function parse(raw) {
  const text = String(raw);
  const paras = [];
  let bookLabel = "", bookN = 0, chap = "", chapN = 0;
  const re = /\r?\n\s*\r?\n/g;
  let at = 0, m;
  const push = (start, end) => {
    const t = text.slice(start, end).replace(/\s+/g, " ").trim();
    if (!t) return;
    const bk = /^(BOOK ([A-Z]+(?:-[A-Z]+)?)|FIRST EPILOGUE|SECOND EPILOGUE)(?::\s*([\d\s\u2013-]+))?\s*$/.exec(t);
    if (bk) { bookN += 1; const yrs = bk[3] ? bk[3].replace(/\s+/g, "").replace("-", "\u2013") : ""; bookLabel = bk[2] ? `Book ${cap(bk[2])}${yrs ? " (" + yrs + ")" : ""}` : cap(bk[1].split(" ")[0]) + " Epilogue"; chap = ""; chapN = 0; return; }
    const ch = /^CHAPTER ([IVXLC]+)\s*$/.exec(t);
    if (ch) { chap = ch[1]; chapN += 1; return; }
    if (!bookLabel || !chap) return;   // front matter, contents
    paras.push({ i: paras.length, book: bookLabel, bookN, chapter: chap, chapN, start, end, text: t, flat: deaccent(t) });
  };
  while ((m = re.exec(text))) { push(at, m.index); at = m.index + m[0].length; }
  push(at, text.length);
  return { chars: text.length, paras, chapters: new Set(paras.map((p) => p.bookN + ":" + p.chapN)).size, text };
}

/** The people an ask names, read off the book: words of the ask the book writes capitalized, often. */
export function namesIn(question, parsed) {
  const words = [...new Set(deaccent(question).toLowerCase().match(/[a-z]{3,}/g) || [])].filter((w) => !STOP.has(w) && !TITLES.has(w));
  const sample = parsed.paras.length > 4000 ? parsed.paras.filter((_, i) => i % 3 === 0) : parsed.paras;
  const out = [];
  for (const w of words) {
    const C = w.charAt(0).toUpperCase() + w.slice(1);
    const reC = new RegExp(`\\b${C}\\b`, "g"), reL = new RegExp(`\\b${w}\\b`, "g");
    let up = 0, low = 0;
    for (const p of sample) { up += (p.flat.match(reC) || []).length; low += (p.flat.match(reL) || []).length; }
    if (up >= 10 && up >= low * 4) out.push({ word: C, n: up });
  }
  return out;
}

const FOCAL_RE = /(?:perspective|point of view|viewpoint|eyes|voice)\s+of\s+([a-z\u00c0-\u024f]+)|([a-z\u00c0-\u024f]+)'s\s+(?:perspective|point of view|eyes)/i;
const sentenceCut = (s, n) => { if (s.length <= n) return s; const cut = s.slice(0, n); const at = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! ")); return at > n * 0.5 ? cut.slice(0, at + 1) : cut + "\u2026"; };

/** The passages the answer must stand on. { names, focal, matched, chapters, passages:[{ ref, url, source, text, at }] } */
export function passagesFor(question, parsed, book, { max = 7, chars = 900 } = {}) {
  const names = namesIn(question, parsed);
  if (!names.length) return { names: [], focal: null, matched: 0, chapters: 0, passages: [] };
  const fm = FOCAL_RE.exec(deaccent(question));
  const fw = fm ? (fm[1] || fm[2]).toLowerCase() : null;
  const focal = fw ? names.find((n) => n.word.toLowerCase() === fw)?.word || null : null;
  const res = names.map((n) => new RegExp(`\\b${n.word}\\b`));
  const hits = parsed.paras.filter((p) => res.every((r) => r.test(p.flat)));
  const score = (p) => 1 + (focal ? Math.min(4, (p.text.match(INTERIOR) || []).length) * 0.6 : 0) + Math.min(1, p.text.length / 1200);
  const best = new Map();
  for (const p of hits) { const k = p.bookN + ":" + p.chapN; const s = score(p); if (!best.has(k) || best.get(k).s < s) best.set(k, { p, s }); }
  const chosen = [...best.values()].sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.p).sort((a, b) => a.i - b.i);
  const passages = chosen.map((p) => ({
    ref: `${book.title} \u2014 ${p.book}, Chapter ${p.chapter}`,
    url: `${book.home}#b${p.bookN}c${p.chapN}`, source: `${book.home}#b${p.bookN}c${p.chapN}`,
    text: sentenceCut(p.text, chars), at: { start: p.start, end: p.end }, via: book.via, bookPlace: { book: p.book, chapter: p.chapter },
  }));
  return { names: names.map((n) => n.word), focal, matched: hits.length, chapters: best.size, passages };
}

/** The line that tells the model what it is holding and how to use it. */
export function bookPrompt(book, found, question) {
  const who = found.names.join(" and ");
  return `These are passages from ${book.title} by ${book.author} (translated by ${book.translator}), read from the whole text: the ${found.passages.length} strongest of ${found.matched} paragraphs where ${who} appear together, in story order${found.focal ? `, favouring ones that tell what ${found.focal} felt or thought` : ""}. Answer the question as an analysis grounded ONLY in these passages${found.focal ? `, following events as ${found.focal} experiences them` : ""}. Name the Book and Chapter for each point. Do not invent scenes, feelings or dialogue the passages do not contain; if the passages do not cover part of the story, say so.`;
}
