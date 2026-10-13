// fold-chat-bookfold.js — the MECHANICAL FOLD of a whole book the fold holds. No model.
//
// The shelf (fold-chat-book.js) is a FIND: it keeps the paragraphs where the people your
// ask names appear. Ask it for the PLOT ("explain the plot of war and peace") and it names
// no person, keeps nothing, and the turn falls through to the web. This module is the FOLD
// the shelf was missing: the chapter-reduction rung. Read the whole book once, and
//   · derive the cast from the book's OWN capitalization (the case-pair test — a token the
//     book almost never writes lowercase is a being; no name list, no census);
//   · give each chapter its event line: the sentence where the book's own cast is densest,
//     measured by who it names and how often the book names them;
//   · fold chapters into books, books into the plot.
// Houdini (khora/native/the-fold/archon-rules.js::houdiniExclusivity) holds every cut: a
// line that names no being, or that talks about its own telling (a chapter, the author,
// the reader), is folded out — the effect is ordinary means, shown, and a line dressed as
// content with no mechanism behind it does not survive. Every line keeps its Book/Chapter
// and its byte span. Pure: no DOM, no IO, no fetch. The port of the War and Peace run
// (fold-plot-test/plot-fold.mjs → war-and-peace-plot-fold.md, 365 chapters → 17 book folds).
//
//   import { plotFold, foldPrompt } from "./fold-chat-bookfold.js";
//   const fold = plotFold(raw, parsed, book, question);   // parsed = fold-chat-book.js::parse()

const WORD = /[A-Za-zÀ-Þà-þ][A-Za-zÀ-þ'’-]+/g;
const SENT = /(?:[^.!?]|\.(?=\d))+[.!?]+|.+$/g;
// A line ABOUT the telling is not an event: the book talking about its own narration.
const META = /\b(chapter|narrat|the author|this book|the reader|as we have seen|as we know|i shall|i will|we shall|we have)\b/i;
// Words a book capitalizes without naming a being (address, titles, the telling's furniture).
const STOP = new Set(["god", "monsieur", "madame", "mademoiselle", "papa", "mamma", "uncle", "aunt", "sir", "yes", "no", "well", "oh", "ah", "chapter", "part", "book", "epilogue"]);
const TITLE = new Set(["prince", "princess", "count", "countess", "emperor", "empress", "general", "king", "queen", "lord", "lady", "colonel", "captain", "major"]);

const deaccent = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// The fold key: case- and accent-free, the possessive stripped, so pierre/Pierre/Pierre's merge.
const foldOf = (s) => deaccent(s).toLowerCase();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The book's cast, from its own capitalization: {key,n,weight}[] by degree. The case-pair test —
 *  a token the book writes capitalized often AND lowercase almost never is a being, not a common word. */
export function foldCast(raw, { min = 25, max = 240 } = {}) {
  const cap = new Map(), low = new Map();
  let m; const re = new RegExp(WORD.source, "g");
  while ((m = re.exec(String(raw)))) {
    const w = m[0];
    const isCap = w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase();
    const k = foldOf(w).replace(/['’]s$/, "");
    if (isCap) cap.set(k, (cap.get(k) || 0) + 1);
    else low.set(k, (low.get(k) || 0) + 1);
  }
  const cast = [];
  for (const [k, c] of cap) {
    if (c < min) continue;
    if (STOP.has(k) || TITLE.has(k)) continue;      // a title or the telling's furniture, not a being
    if (/['’]/.test(k)) continue;                   // a contraction (i'll, i'm) is not a name
    if ((low.get(k) || 0) > c * 0.1) continue;      // a common word the book also capitalizes at a sentence start
    cast.push({ key: k, n: c });
  }
  cast.sort((a, b) => b.n - a.n);
  return cast.slice(0, max).map((x) => ({ ...x, weight: Math.log(1 + x.n) }));
}

/** The event line of a stretch of text: the sentence where the cast is densest, Houdini-folded.
 *  Returns { best:{t,off,len,sc,named}|null, foldedMeta } — foldedMeta counts the telling-lines cut. */
export function eventLine(text, cast) {
  const ss = [];
  let x; const re = new RegExp(SENT.source, "g");
  while ((x = re.exec(text))) {
    const t = x[0].replace(/\s+/g, " ").trim();
    if (t.length >= 30 && t.length <= 500) ss.push({ t, off: x.index, len: x[0].length });
  }
  let best = null, foldedMeta = 0;
  for (const sen of ss) {
    const f = foldOf(sen.t);
    const named = cast.filter((b) => new RegExp(`\\b${esc(b.key)}\\b`).test(f));
    if (!named.length) continue;                    // Houdini: no being -> not an event
    if (META.test(sen.t)) { foldedMeta++; continue; }   // Houdini: about the telling
    const sc = named.reduce((a, b) => a + b.weight, 0) + named.length * 0.5 - sen.t.length / 1500;
    if (!best || sc > best.sc) best = { ...sen, sc, named: named.map((b) => b.key) };
  }
  return { best, foldedMeta };
}

/** Group a parsed book's paragraphs into chapters, in story order, each with its byte span. */
export function chaptersOf(parsed) {
  const out = [], byKey = new Map();
  for (const p of parsed?.paras || []) {
    const key = p.bookN + ":" + p.chapN;
    let ch = byKey.get(key);
    if (!ch) { ch = { key, book: p.book, chapter: p.chapter, bookN: p.bookN, chapN: p.chapN, start: p.start, end: p.end }; byKey.set(key, ch); out.push(ch); }
    else { if (p.start < ch.start) ch.start = p.start; if (p.end > ch.end) ch.end = p.end; }
  }
  return out;
}

/** Fold the whole book: cast · chapter event lines · book folds · the plot. No model.
 *  Returns { cast, books:[{label, fold, foldWhere, chapters:[{...ch, line}]}], plot:[{label, line, where}], passages, chapterCount, foldedOut }. */
export function plotFold(raw, parsed, book, question = "", { castMin = 25, castMax = 240 } = {}) {
  const cast = foldCast(raw, { min: castMin, max: castMax });
  const chapters = chaptersOf(parsed);
  const books = [], byLabel = new Map();
  let foldedOut = 0, withLine = 0;
  for (const ch of chapters) {
    const { best, foldedMeta } = eventLine(raw.slice(ch.start, ch.end), cast);
    if (foldedMeta) foldedOut += foldedMeta;
    const line = best ? { text: best.t, off: best.off, len: best.len, at: ch.start + best.off, sc: best.sc, named: best.named } : null;
    if (line) withLine++;
    let bk = byLabel.get(ch.book);
    if (!bk) { bk = { label: ch.book, chapters: [] }; byLabel.set(ch.book, bk); books.push(bk); }
    bk.chapters.push({ book: ch.book, chapter: ch.chapter, bookN: ch.bookN, chapN: ch.chapN, start: ch.start, end: ch.end, line });
  }
  // A book folds to the strongest event line of its chapters (the plot's one line per book).
  for (const bk of books) {
    const top = bk.chapters.filter((c) => c.line).sort((a, b) => b.line.sc - a.line.sc)[0] || null;
    bk.fold = top ? top.line.text : null;
    bk.foldWhere = top ? `${bk.label.replace(/ \(.*\)/, "")}, Chapter ${top.chapter}` : null;
    bk.foldAt = top ? { start: top.line.at, end: top.line.at + top.line.len } : null;
  }
  const passageOf = (bk) => ({
    ref: `${book.title} — ${bk.foldWhere || bk.label}`,
    url: `${book.home}#${bk.foldWhere ? "ch" : "book"}`, source: `${book.home}#${bk.foldWhere ? "ch" : "book"}`,
    text: bk.fold, at: bk.foldAt, via: book.via,
    bookPlace: { book: bk.label, chapter: bk.foldWhere ? bk.foldWhere.split(", Chapter ")[1] : "" },
  });
  const passages = books.filter((b) => b.fold).map(passageOf);
  return {
    cast: cast.map((c) => c.key), castN: cast.length,
    books, plot: books.map((b) => ({ label: b.label, line: b.fold, where: b.foldWhere })),
    passages, chapterCount: chapters.length, withLine, foldedOut,
    question: String(question || ""),
  };
}

/** The line that tells the model what it is holding: the book's own mechanical fold, no model wrote it. */
export function foldPrompt(book, fold, question) {
  const who = fold.cast.slice(0, 12).join(", ");
  const plot = fold.plot.filter((p) => p.line).map((p) => `- ${p.label} — ${p.line}`).join("\n");
  return `These are the event lines of ${book.title} by ${book.author} (translated by ${book.translator}), folded MECHANICALLY from the whole text with no model writing them: each chapter was reduced to the sentence where the book's own cast is densest, and each book to its strongest chapter line. The cast the fold derived from the book's own capitalization (by degree): ${who}. The plot, one line per book, in order:\n${plot}\n\nAnswer the question as a grounded account of the book, following this fold's order. Use only what these lines and the cast carry; name the Book and Chapter a point comes from; where the fold does not cover part of the story (a chapter with no event line), say so plainly instead of filling it in. Do not invent scenes, feelings or dialogue the lines do not contain.`;
}
