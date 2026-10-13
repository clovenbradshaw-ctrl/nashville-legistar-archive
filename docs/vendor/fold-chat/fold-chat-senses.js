// fold-chat-senses.js — when ONE bare word names several things, say so.
//
// "tell me about mercury" was answered only as Freddie Mercury (six sources),
// with no word that Mercury is also a planet, an element and a Roman god. The
// sources the search read were all about one sense, so the sense list cannot come
// from them; it comes from a lookup of the bare term itself:
//
//   senseTerm        is this ask just ONE word/short name ("tell me about X",
//                    "what is X", "X")? If the ask carries any other content word
//                    the person has already chosen a sense — nothing is added.
//   disambiguationOf the Wikipedia search results for that bare term. The term is
//                    AMBIGUOUS only when Wikipedia itself holds an exact-title
//                    page for it that says it refers to several things (its
//                    disambiguation page: "Mercury most commonly refers to…").
//                    "Paris", "Mars" and "Apple" have a real article under the
//                    exact title, so they are NOT flagged. The senses listed are
//                    Wikipedia's own distinct titles that contain the term — an
//                    app-authored line, never model prose.
//   sensesLine       the one line a person reads, small and dismissible.
//
// Pure. The lookup itself is done by the surface (fold-chat-web.js `search`),
// through the audited fetch, and handed here as plain results.

const fold = (s) => String(s ?? "").normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase().trim();
const tokensOf = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// DECLARED stems (II.11): what leads a "tell me about X" ask, per language.
const STEMS = /^(?:(?:please\s+)?(?:tell me (?:all )?about|tell me more about|what is|what's|what are|who is|who was|who's|who are|define|explain|info(?:rmation)? (?:on|about)|more about|all about|about|i want to know about|what do you know about)\s+|(?:háblame de|hablame de|qué es|que es|quién es|cuéntame sobre|qu'est-ce que|qui est|parle-moi de|c'est quoi|was ist|wer ist|erzähl mir (?:etwas )?über|расскажи (?:мне )?о|расскажи про|что такое|кто такой|什么是|什麼是|谁是|誰是|介绍一下|について教えて)\s*)/iu;

/** The one bare term an ask is about, or null. Needs the WHOLE ask to be that term (plus a declared stem). */
export function senseTerm(question) {
  let q = String(question ?? "").trim().replace(/[?？!！.。]+$/u, "").trim();
  if (!q || q.length > 60) return null;
  for (let i = 0; i < 2 && STEMS.test(q); i++) q = q.replace(STEMS, "").trim();
  q = q.replace(/^(?:the|a|an|el|la|le|les|der|die|das)\s+/i, "").trim();
  const toks = tokensOf(q);
  // one word, or a two-word name — never a question with more in it
  if (toks.length < 1 || toks.length > 2) return null;
  if (toks.some((t) => t.length < 3 && !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(t))) return null;
  if (/[\d@#/\\]/.test(q)) return null;
  return q;
}

const DISAMBIG_SNIPPET = /\b(?:may (?:also )?refer to|(?:most )?(?:commonly|often) refers? to|can refer to|refers? to (?:several|multiple|more than)|look up [\s\S]{0,60} in wiktionary|disambiguation)\b/i;
const isDisambigTitle = (t) => /\(disambiguation\)\s*$/i.test(String(t ?? ""));

// A DISAMBIGUATION PAGE is a list of senses, never a source. The banner ("X may refer to…", "Topics referred to by the
// same term") sits in the page's own opening, so only the first ~500 chars are tested — an article that merely contains
// the word "disambiguation" in a hatnote is not caught.
const DISAMBIG_LEAD = /\b(?:may (?:also )?refer to|(?:most )?(?:commonly|often) refers? to|can refer to|refers? to (?:several|multiple|more than)|topics? referred to by the same term|this disambiguation page|is a disambiguation page|set index article)\b/i;

/** Does this page text read as a DISAMBIGUATION page? If so it is a pointer, never ground. */
export function looksDisambiguation(text) {
  const head = String(text ?? "").replace(/\s+/g, " ").slice(0, 500);
  return DISAMBIG_LEAD.test(head);
}

/** From the Wikipedia results for the bare `term`: { term, senses:[{label, url}], page:{title,url} } or null.
 *  results: [{ title, url, snippet }]. */
export function disambiguationOf(term, results, { max = 5 } = {}) {
  const list = Array.isArray(results) ? results.filter((r) => r && r.title) : [];
  const t = fold(term);
  if (!t || !list.length) return null;
  const exact = list.find((r) => fold(r.title) === t);
  // Only an exact-title page that says it refers to several things makes the term ambiguous.
  if (!exact || !DISAMBIG_SNIPPET.test(String(exact.snippet || ""))) return null;
  const tt = tokensOf(term);
  const seen = new Set([fold(exact.title)]);
  const senses = [];
  for (const r of list) {
    const key = fold(r.title);
    if (seen.has(key) || isDisambigTitle(r.title)) continue;
    const toks = tokensOf(r.title);
    // the title must contain the term as whole tokens, and be about something more specific than the bare term
    if (!tt.every((x) => toks.includes(x))) continue;
    seen.add(key);
    senses.push({ label: r.title, url: r.url || null });
    if (senses.length >= max) break;
  }
  if (senses.length < 2) return null;
  return { term: String(term).trim(), senses, page: { title: exact.title, url: exact.url || null }, more: list.filter((r) => !seen.has(fold(r.title)) && !isDisambigTitle(r.title) && tokensOf(r.title).includes(tt[0])).length > 0 };
}

/** The line a person reads: "Mercury can mean: Mercury (element), Mercury (planet), Freddie Mercury …" */
export function sensesLine(d, { english = true } = {}) {
  if (!d || !d.senses?.length) return "";
  const term = d.term.charAt(0).toUpperCase() + d.term.slice(1);
  const labels = d.senses.map((s) => s.label).join(", ");
  return english ? `${term} can mean: ${labels}${d.more ? " …" : ""}` : `${term} · ${labels}${d.more ? " …" : ""}`;
}
