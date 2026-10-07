// about.js — a question ABOUT the material, answered from a view of the
// material rather than from a passage of it.
//
// Measured live (2026-09-08): War and Peace attached, asked "what's this book
// about?", and the answer was "a man named Caesar and his commentary on his
// military campaigns". The question's one content word is "book", so
// retrieval returned chapters about Prince Bolkonsky's EXERCISE BOOK, and the
// mouth answered from those. Handing it the title page stopped the invention
// and left an echo of the one passage it had.
//
// The user's own diagnosis is the design (2026-09-08): "a small model call
// given the content and SEEING that this was attached (so it has a meta view)
// would have correctly understood what the user was asking… it should see the
// raw json that it was given, but not mistake its role to be to answer it";
// and then: "it should get an abbreviated, whether folded or ellipsed,
// section of the content so it doesn't get overwhelmed by the content the
// talker will use."
//
// So there are TWO DIETS, and this module builds the second one:
//   the TALKER eats the content — the snips, the passages retrieved for the
//     question's own words.
//   the ABOUT view eats the SITUATION — what is attached, what it says it is,
//     how big it is, how much of it has been read — plus an ELLIPSED sample
//     of the content, spread across the whole source rather than taken from
//     its front, and capped by a declared budget.
//
// WHY THE SAMPLE IS SPREAD, not the first N passages: the front of a book is
// its title page and its licence. A sample taken there describes Project
// Gutenberg. A sample taken at even intervals across the whole extent is a
// sample OF THE BOOK, and it says in its own words that it is a sample.
//
// WHAT THIS MODULE NEVER DOES: it does not answer. It builds a view and says
// what the view left out. Every number in it is counted, never estimated, and
// nothing here is an instruction to a model (P55) — the view is a fact, and
// the ellipsis marks are where facts stop.
//
// Pure: no DOM, no model, no engine.

/** How much of the content the about view may carry, in characters. Declared (P9). */
export const ABOUT_DIGEST_CHARS = 2400;
/** How many places across the source are sampled. Declared (P9), by construction — enough to span a whole book without spending the character budget on any one. */
export const ABOUT_SAMPLES = 16;
/** How much of one sampled passage is kept before it is ellipsed. Declared (P9), by construction. */
export const ABOUT_SAMPLE_CHARS = 220;

// The ways a person asks what the material IS, rather than asking it a
// question. "What is this about" is the flagship; "what did I attach", "what
// am I reading", "what is this file/book/document" are the same ask in other
// words. NOT here on purpose: "what does it say about X" — that is a question
// about the material's CONTENT and belongs to retrieval, which is the door
// this one must never steal from.
const ABOUT_RE = /\b(?:what(?:'s| is| are)?\s+(?:this|that|these|the)\s+(?:book|file|document|source|text|novel|paper|material|thing)?\s*(?:about|say|contain)\b|what(?:'s| is)?\s+(?:this|it)\s*\?|what\s+(?:did|have)\s+i\s+(?:attach|add|load|give you|upload)\b|what\s+am\s+i\s+reading\b|what\s+(?:are|is)\s+(?:my|the)\s+sources?\b|what\s+(?:do|did)\s+you\s+have\b|tell me about (?:this|the) (?:book|file|document|source|text|novel|material)\b|describe (?:this|the) (?:book|file|document|source|text|material)\b|what kind of (?:book|document|file|text|thing) is (?:this|it)\b|\bis\s+(?:this|that|it)\s+(?:a|an|the)\s+(?:book|novel|file|document|text|source|paper|material)\s*\??$)/i;
// A question naming something IN the material is not a question about the
// material, however it is phrased: "what does this book say about Napoleon"
// is retrieval's. The tell is a word the ask itself supplies beyond the
// furniture below.
const FURNITURE = new Set(["what", "whats", "what's", "is", "are", "this", "that", "these", "the", "a", "an", "about", "book", "file", "document", "source", "text", "novel", "paper", "material", "thing", "it", "did", "have", "i", "attach", "attached", "add", "added", "load", "loaded", "reading", "am", "my", "sources", "do", "you", "tell", "me", "describe", "kind", "of", "say", "says", "contain", "contains", "give", "gave", "upload", "uploaded", "and", "in", "here", "now", "so", "far"]);

const words = (t) => String(t ?? "").toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

/**
 * asksAboutMaterial(question) → true when the question asks what the material
 * IS. A question that also names something of its own ("what does this book
 * say about Napoleon") is retrieval's, not this door's — the extra word is
 * the tell, and it is decided by what the question supplies beyond the ask's
 * own furniture, never by a list of topics.
 */
export function asksAboutMaterial(question) {
  const q = String(question ?? "");
  if (!ABOUT_RE.test(q)) return false;
  return !words(q).some((w) => !FURNITURE.has(w));
}

/**
 * materialView({ sources, chunks, reading, media }) → the situation, as data:
 * one row per source with what it says it is, how big it is, how many
 * passages it was cut into, and how much of it has been read so far. Counted,
 * never estimated; a source that declares no identity says so rather than
 * being given one.
 *
 * `sources` (the app's full-text-by-name dict) is OPTIONAL — a row exists for
 * every name `chunks` mentions too, not only for a name `sources` happens to
 * carry. This is what lets the engine side (holon.js, which has `chunks` and
 * never `state.sources`) build the same view the app does: the character
 * count falls back to the sum of that source's own chunk text when `sources`
 * doesn't name it, which is exact (chunking always covers the whole file) and
 * never estimated.
 */
export function materialView({ sources = {}, chunks = [], reading = new Map(), media = {} } = {}) {
  const byName = new Map();
  for (const c of chunks) {
    const n = c?.source;
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, { passages: 0, chars: 0, declared: c?.identity?.declared ?? null, kind: c?.identity?.kind ?? null, guess: c?.identity?.guess ?? null });
    const seen = byName.get(n);
    seen.passages += 1;
    seen.chars += String(c?.text ?? "").length;
  }
  const names = new Set([...Object.keys(sources), ...byName.keys()]);
  const rows = [...names].map((name) => {
    const seen = byName.get(name) ?? { passages: 0, chars: 0, declared: null, kind: null, guess: null };
    const r = reading instanceof Map ? reading.get(name) : reading?.[name];
    const read = r && Number.isFinite(r.cursor) ? r.cursor : null;
    const total = r && Number.isFinite(r.total) ? r.total : seen.passages;
    const characters = Object.prototype.hasOwnProperty.call(sources, name) ? String(sources[name] ?? "").length : seen.chars;
    return {
      name,
      title: seen.declared?.title ?? null,
      author: seen.declared?.author ?? null,
      titleGiver: seen.declared?.giver ?? null,
      kind: seen.kind ?? null,
      looksLike: seen.guess ?? null,
      characters,
      passages: seen.passages,
      read, total,
    };
  });
  for (const name of Object.keys(media)) rows.push({ name, title: null, author: null, titleGiver: null, kind: media[name]?.kind ?? "media", looksLike: null, characters: null, passages: 0, read: null, total: null });
  return rows;
}

/**
 * abbreviate(chunks, { chars, samples, each }) → { text, of, kept, places } —
 * an ELLIPSED sample of a source, spread at even intervals across the whole
 * of it, each piece clipped and joined with an ellipsis so the gaps are
 * visible as gaps. The budget is a character budget, because that is what a
 * small model's attention is spent in; `of` and `kept` say what was left out.
 */
export function abbreviate(chunks = [], { chars = ABOUT_DIGEST_CHARS, samples = ABOUT_SAMPLES, each = ABOUT_SAMPLE_CHARS } = {}) {
  const list = chunks.filter((c) => String(c?.text ?? "").trim());
  if (!list.length) return { text: "", of: 0, kept: 0, places: [] };
  const want = Math.max(1, Math.min(samples, list.length));
  const step = list.length / want;
  const picked = [];
  for (let i = 0; i < want; i += 1) picked.push(list[Math.min(list.length - 1, Math.floor(i * step))]);
  const parts = [];
  const places = [];
  let spent = 0;
  for (const c of picked) {
    const one = String(c.text).replace(/\s+/g, " ").trim();
    const clipped = one.length > each ? `${one.slice(0, each - 1)}…` : one;
    if (spent + clipped.length > chars) break;
    spent += clipped.length;
    parts.push(clipped);
    places.push(c.ref ?? null);
  }
  return { text: parts.join(" … "), of: list.length, kept: parts.length, places };
}

const plural = (n, one, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * aboutBlock(rows, digest) → the block a turn about the material is handed:
 * the situation in plain sentences, then the ellipsed sample, labelled as a
 * sample of how many pieces out of how many. Facts, never instructions; no
 * address, because the mouth never sees one.
 */
export function aboutBlock(rows = [], digest = null) {
  if (!rows.length) return "";
  const lines = rows.map((r) => {
    const bits = [];
    if (r.title) bits.push(`says on its own title page that it is “${r.title}”${r.author ? `, by ${r.author}` : ""}`);
    else if (r.looksLike) bits.push(`looks like ${r.looksLike}`);
    if (r.characters != null) bits.push(`${plural(r.characters, "character")} long`);
    if (r.passages) bits.push(`cut into ${plural(r.passages, "passage")}`);
    if (r.read != null && r.total) bits.push(r.read >= r.total ? "read through" : `read as far as ${r.read.toLocaleString()} of ${r.total.toLocaleString()} so far`);
    return `- ${r.name}${bits.length ? `: ${bits.join(", ")}` : ""}`;
  });
  const head = `What is attached, and what it says it is:\n${lines.join("\n")}`;
  if (!digest?.text) return head;
  return `${head}\n\nA sample of the text itself — ${plural(digest.kept, "piece")} taken at even intervals from ${digest.of.toLocaleString()}, each cut short, the gaps marked with an ellipsis:\n${digest.text}`;
}
