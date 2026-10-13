// fold-chat-answercard.js — draw ONE answer (AnswerTurn@1, docs/ANSWER-PIPELINE.md): the answer line, the source's own
// sentence beneath it, the citation, what was checked, and — behind a native disclosure — the app-authored "how I reasoned".
// Two halves, both with no clock reads and no network:
//   answerCardModel(turn)            PURE: a plain-JSON model the view draws and the tests assert on.
//   renderAnswerCard(turn, {doc})    DOM:  createElement / textContent / append(string) ONLY. The quote is DATA (a page's own
//                                    words), so nothing here ever parses markup.
//   mountAnswerCard(msgEl, msg)      appends the card to an assistant message when msg.answerTurn exists; no-op otherwise.
//
// What this module refuses to do (the product rules, written where they bite):
//   * It never rewrites. The source sentence is shown verbatim, once. A headline that IS the sentence is not drawn twice.
//   * It never ships an answer that cannot show its source: an answer with no source sentence, or whose standing is not
//     "survived", is drawn as a gap, never as an answer. A turn that carries a gap is drawn as that gap even if it also
//     carries an answer (the conservative reading). A turn with nothing at all is drawn as a gap, never an empty card.
//   * It says nothing about which of two contesting sources is right.
//   * No case logic: nothing here looks at letter case. Names come from the pipeline (title resolution); this module only
//     slices offsets it was given (and checks them against the text before trusting them).
//   * A gap is drawn, not said: the labels below are FIXED app-authored strings keyed by the gap's kind.
import { ANSWERCARD_CSS, ANSWERCARD_STYLE_ID } from "./fold-chat-answercard.css.js";
import { isTertiary, pathWords, pointerWords } from "./fold-chat-origin.js";

// ---- the fixed words (DECLARED, not measured; giver: the user's brief "a gap is drawn, not said" + BUILD-3's task text for
// the four it names; the three marked (*) are this module's author's plain-words wording, flagged for the user to reword) ----
export const GAP_LABELS = Object.freeze({
  unwitnessed: "No source I read says who holds this.",
  no_present_holder: "The closest source speaks of the past, not the present.",
  refuted: "A source I checked says otherwise.",
  unreached: "I couldn’t reach a source to check this.",               // (*)
  frame_unread: "I couldn’t tell what was being asked.",               // (*)
  no_grammar_for_language: "I can’t read questions in this language yet.",
});
export const GAP_UNKNOWN = "I couldn’t settle this.";                  // (*) a kind this build has no label for
// "unwitnessed" says WHO because the first slot asks are people; for another slot the same silence is worded for that slot
// (giver: this module's author, English only, flagged). Used only when the turn names its slot (turn.slot or turn.frame.slot).
export const UNWITNESSED_BY_SLOT = Object.freeze({
  time: "No source I read says when.", quantity: "No source I read gives the number.",
  place: "No source I read says where.", thing: "No source I read states this.",
});
const CLOSEST_LABEL = Object.freeze({ refuted: "What that source says:" });
export const CLOSEST_DEFAULT = "The closest sentence I found:";
export const CONTEST_LABEL = "These sources give different answers.";
export const CHECKED_NONE = "only the source itself.";
export const TRACE_SUMMARY = "how I reasoned";

// ---- small readers (defensive: a turn is data from elsewhere) ----
const isStr = (s) => typeof s === "string" && s.trim() !== "";
const str = (s) => (isStr(s) ? s : "");
const asArr = (a) => (Array.isArray(a) ? a : []);
const strs = (a) => asArr(a).filter(isStr);
const isLowSurrogate = (c) => c >= 0xdc00 && c <= 0xdfff;
const safeUrl = (u) => (typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : null);
const safeLang = (l) => (typeof l === "string" && /^[a-z0-9-]{2,12}$/i.test(l) ? l : "");

/** Clean a list of [start,end) UTF-16 spans against `text`: drop the broken ones, never split a surrogate pair, sort, merge. */
export function cleanSpans(text, spans) {
  const t = String(text ?? ""); const len = t.length; const out = [];
  for (const s of asArr(spans)) {
    if (!Array.isArray(s)) continue;
    let a = Math.trunc(s[0]); let b = Math.trunc(s[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    a = Math.max(0, a); b = Math.min(len, b);
    if (b <= a) continue;
    if (a > 0 && isLowSurrogate(t.charCodeAt(a))) a -= 1;
    if (b < len && isLowSurrogate(t.charCodeAt(b))) b += 1;
    out.push([a, b]);
  }
  out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const merged = [];
  for (const s of out) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([s[0], s[1]]);
  }
  return merged;
}

/** Cut `text` at the spans: [{text, on}] whose texts concatenate back to `text` exactly. */
export function segmentsOf(text, spans) {
  const t = String(text ?? ""); const out = []; let at = 0;
  for (const [a, b] of cleanSpans(t, spans)) {
    if (a > at) out.push({ text: t.slice(at, a), on: false });
    out.push({ text: t.slice(a, b), on: true }); at = b;
  }
  if (at < t.length) out.push({ text: t.slice(at), on: false });
  return out;
}

/** Where the filler sits in `text`: its own span if that span really holds the filler's text, else the first place the text occurs. */
function fillerSpan(text, filler) {
  if (!filler || !isStr(filler.text)) return null;
  const s = filler.span;
  if (Array.isArray(s) && text.slice(s[0], s[1]) === filler.text) return [s[0], s[1]];
  const i = text.indexOf(filler.text);
  return i < 0 ? null : [i, i + filler.text.length];
}

const siteOf = (host) => (/(^|\.)wikipedia\.org$/i.test(host) ? "Wikipedia" : String(host).replace(/^www\./i, ""));

/** The citation: { label: "Monarchy of the United Kingdom — Wikipedia", title, site, url, host }, or null when nothing names the source. */
export function citeOf(source) {
  if (!source || typeof source !== "object") return null;
  const url = safeUrl(source.url);
  let host = str(source.host).trim();
  if (!host && url) { try { host = new URL(url).hostname; } catch { host = ""; } }
  const site = str(source.site).trim() || siteOf(host);
  const title = str(source.title).trim();
  const label = title && site ? title + " — " + site : title || site || url || "";
  return label ? { label, title, site, url, host } : null;
}

/** The citation a ROW is shown under. An encyclopedia is never cited (fold-chat-origin.js): a row found there is cited as the original page
 *  its own reference led to — with the `path` there — or, when none could be read, as a POINTER (`kind: "pointer"`) listing the pages the
 *  article points at, each a link, with the encyclopedia named only as where the lead was found. Any other source is cited as it is. */
export function citeOfRow(row) {
  const src = row && typeof row === "object" ? row.source : null;
  const o = row && typeof row === "object" && row.origin && typeof row.origin === "object" ? row.origin : null;
  if (o && o.status === "origin" && o.origin && isStr(o.origin.url) && isStr(o.origin.sentence)) {
    const c = citeOf({ title: o.origin.title, url: o.origin.url, host: o.origin.host });
    return c ? { ...c, path: pathWords(o) } : null;
  }
  if (src && isTertiary(src.url)) {
    const pointers = asArr(o && o.refs).map((r) => ({ label: str(r.label) || str(r.host) || str(r.url || r.archived), url: safeUrl(r.url || r.archived), n: Number.isFinite(r.n) ? r.n : null })).filter((r) => r.url);
    return { label: o ? pointerWords(o) : "Found in an encyclopedia \u2014 not cited: no original source was followed.", title: "", site: "", url: null, host: "", kind: "pointer", pointers: pointers.slice(0, 6), path: o ? pathWords(o) : [] };
  }
  return citeOf(src);
}

const usableRow = (r) => !!r && typeof r === "object" && isStr(r.sentence);

/** A row's sentence as a quote: verbatim text + the spans to draw bold (the matched words and the filler, validated against the text). */
function quoteOf(row) {
  const o = row.origin;
  if (o && o.status === "origin" && o.origin && isStr(o.origin.url) && isStr(o.origin.sentence)) row = { ...row, sentence: o.origin.sentence, emphasis: [], source: { ...row.source, lang: row.source && row.source.lang } };   // the cited page's OWN words, not the encyclopedia's
  const text = row.sentence;
  const f = fillerSpan(text, row.filler);
  return { text, emphasis: cleanSpans(text, [...asArr(row.emphasis), ...(f ? [f] : [])]), lang: safeLang(row.source?.lang) };
}

const textOfTried = (x) => (isStr(x) ? x : x && typeof x === "object" ? [x.query, x.text, x.label, x.name].find(isStr) || "" : "");

function voidUnmeasured(node, out, seen, depth) {
  if (!node || typeof node !== "object" || seen.has(node) || depth > 24) return;
  seen.add(node);
  if ((node.status === "unmeasured" || node.basis === "unmeasured") && isStr(node.text)) out.push(node.text);
  for (const c of asArr(node.children)) voidUnmeasured(c, out, seen, depth + 1);
}

function traceLines(trace) {
  const out = [];
  asArr(trace).forEach((l, i) => {
    if (!l || typeof l !== "object" || !isStr(l.say)) return;
    const probe = l.probe && typeof l.probe === "object" ? { query: str(l.probe.query), why: str(l.probe.why) } : null;
    out.push({
      n: Number.isFinite(l.n) ? l.n : i + 1, say: l.say, detail: str(l.detail), result: str(l.result),
      probe: probe && (probe.query || probe.why) ? probe : null,
      unmeasured: l.unmeasured === true || l.status === "unmeasured" || l.basis === "unmeasured",
    });
  });
  return out;
}

function gapModel(g, turn, fallbackRow) {
  const kind = isStr(g?.kind) ? g.kind : "unwitnessed";
  const slot = str(turn.slot) || str(turn.frame?.slot);
  const label = kind === "unwitnessed" ? (UNWITNESSED_BY_SLOT[slot] || GAP_LABELS.unwitnessed) : GAP_LABELS[kind] || GAP_UNKNOWN;
  const row = [g?.closest, asArr(g?.refuters)[0], fallbackRow].find(usableRow) || null;
  return {
    kind, known: Object.hasOwn(GAP_LABELS, kind), label,
    closest: row ? { label: CLOSEST_LABEL[kind] || CLOSEST_DEFAULT, quote: quoteOf(row), cite: citeOfRow(row) } : null,
    tried: asArr(g?.tried).map(textOfTried).filter(Boolean), closeBy: strs(g?.closeBy),
  };
}

/** AnswerTurn@1 → the card's plain-JSON model. Never throws; a turn with nothing in it becomes a gap. */
export function answerCardModel(turn) {
  const t = turn && typeof turn === "object" ? turn : {};
  const unm = []; voidUnmeasured(t.void, unm, new WeakSet(), 0);
  const a = t.answer && typeof t.answer === "object" ? t.answer : null;
  for (const u of strs(a?.unmeasured)) unm.push(u);
  const base = {
    schema: "AnswerCard@1", said: str(t.said), searched: strs(t.searched), kind: "gap",
    headline: null, cite: null, quote: null, checked: [], unmeasured: [...new Set(unm)], trace: traceLines(t.trace), contest: [], gap: null,
  };
  const rows = []; const seen = new Set();
  for (const r of asArr(t.contest)) {
    if (!usableRow(r)) continue;
    const key = r.sentence + "\u0000" + str(r.source?.url);
    if (!seen.has(key)) { seen.add(key); rows.push(r); }
  }

  // 1. a typed gap is the turn's outcome (even beside an answer: the conservative reading)
  if (t.gap && typeof t.gap === "object") return { ...base, kind: "gap", gap: gapModel(t.gap, t, rows.length === 1 ? rows[0] : null) };
  // 2. an answer ships only with its own source sentence and only as "survived"
  const row = a && usableRow(a.row) ? a.row : null;
  // "unmeasured" ships too (the ANSWERTURN integration): the source states it and no check could be run, and the card says so
  // through `checked` (only the source itself) and the "Not checked" line. Anything else (held, true, "") is not a standing.
  if (a && row && (a.standing === "survived" || a.standing === "unmeasured")) {
    const text = isStr(a.text) ? a.text : row.sentence;
    const f = fillerSpan(text, a.filler || row.filler);
    const quote = quoteOf(row);
    return {
      ...base, kind: "answer", standing: a.standing, headline: { text, bold: f ? [f] : [] }, cite: citeOfRow(row),
      quote: { ...quote, shownAsHeadline: text === quote.text },
      checked: strs(a.survived),
    };
  }
  // 3. rows that give different fillers for the same slot: side by side, nothing said about which is right
  if (rows.length >= 2) {
    return { ...base, kind: "contest", contest: rows.map((r) => ({ label: str(r.filler?.text), quote: quoteOf(r), cite: citeOfRow(r) })) };
  }
  // 4. nothing usable: a gap, never an empty card (an answer that could not show its source was never witnessed)
  return { ...base, kind: "gap", gap: gapModel(null, t, rows.length === 1 ? rows[0] : null) };
}

// ---- the view (DOM: createElement / textContent / append(string) only) ----
function ensureStyle(doc) {
  try {
    if (doc.getElementById?.(ANSWERCARD_STYLE_ID)) return;
    const s = doc.createElement("style"); s.id = ANSWERCARD_STYLE_ID; s.textContent = ANSWERCARD_CSS; doc.head?.append(s);
  } catch { /* a page with no head still gets the card, only unstyled */ }
}

function make(doc, tag, cls, text) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/** `text` with the spans drawn as `tag` elements (<strong> for the answer, <mark> for the quote); the words themselves are untouched. */
function marked(doc, parent, text, spans, tag) {
  for (const seg of segmentsOf(text, spans)) {
    if (seg.on) parent.append(make(doc, tag, "", seg.text)); else parent.append(seg.text);
  }
  return parent;
}

function quoteEl(doc, q) {
  const bq = make(doc, "blockquote", "answer-quote");
  if (q.lang) bq.setAttribute("lang", q.lang);
  return marked(doc, bq, q.text, q.emphasis, "mark");
}

function citeEl(doc, c) {
  const d = make(doc, "div", "answer-cite");
  d.append(make(doc, "span", "answer-cite-title", c.label));
  if (c.url) {
    const a = make(doc, "a", "", "open ↗");
    a.setAttribute("href", c.url); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
    a.setAttribute("aria-label", "Open " + c.label + " in a new tab");
    d.append(" ", a);   // the space keeps the text readable when it is read out or copied (a flex row ignores it visually)
  }
  // the pages an encyclopedia only POINTS at (never cited, so never an "open" on the encyclopedia itself): each a link to fetch
  if (c.kind === "pointer" && Array.isArray(c.pointers) && c.pointers.length) {
    const ul = make(doc, "span", "answer-pointers");
    c.pointers.forEach((p) => {
      const a = make(doc, "a", "", (p.n ? `[${p.n}] ` : "") + p.label);
      a.setAttribute("href", p.url); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
      ul.append(a, " ");
    });
    d.append(" ", ul);
  }
  // the path the claim travelled to this page: where it was found → the reference → the page (a hop with an address is a link)
  if (Array.isArray(c.path) && c.path.length > 1) {
    const p = make(doc, "span", "answer-path");
    p.append("found via ");
    c.path.forEach((h, i) => {
      if (i) p.append(" \u2192 ");
      if (h.url) { const a = make(doc, "a", "", h.text); a.setAttribute("href", h.url); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer"); p.append(a); } else p.append(h.text);
    });
    d.append(" ", p);
  }
  return d;
}

function traceEl(doc, lines) {
  const det = make(doc, "details", "answer-trace");
  det.append(make(doc, "summary", "", TRACE_SUMMARY));
  const ol = make(doc, "ol", "trace-list");
  for (const l of lines) {
    const li = make(doc, "li", "trace-line" + (l.unmeasured ? " is-unmeasured" : ""));
    li.append(l.say);
    if (l.unmeasured) li.append(" ", make(doc, "span", "trace-unmeasured", "(I couldn’t check this)"));
    if (l.detail) li.append(make(doc, "span", "trace-detail", l.detail));
    if (l.probe && l.probe.query && !l.say.includes(l.probe.query) && !l.detail.includes(l.probe.query)) li.append(make(doc, "span", "trace-searched", "I searched “" + l.probe.query + "”"));
    if (l.probe && l.probe.why && !l.detail) li.append(make(doc, "span", "trace-detail", "Why: " + l.probe.why));
    if (l.result) li.append(make(doc, "span", "trace-result", "Found: " + l.result));
    ol.append(li);
  }
  det.append(ol);
  return det;
}

function gapEl(doc, g) {
  const box = make(doc, "div", "gap gap-" + (g.known ? g.kind : "unknown"));
  box.setAttribute("role", "note");
  const h = make(doc, "div", "gap-h");
  const mark = make(doc, "span", "gap-mark", "⟂"); mark.setAttribute("aria-hidden", "true");
  h.append(mark, make(doc, "span", "gap-kind", g.label));
  box.append(h);
  if (g.closest) {
    box.append(make(doc, "div", "gap-sub", g.closest.label), quoteEl(doc, g.closest.quote));
    if (g.closest.cite) box.append(citeEl(doc, g.closest.cite));
  }
  if (g.tried.length) box.append(make(doc, "div", "gap-text gap-attempts", "tried: " + g.tried.join(", ")));
  if (g.closeBy.length) box.append(make(doc, "div", "gap-text gap-close", "to close it: " + g.closeBy.join(" · ")));
  return box;
}

/** Draw an AnswerTurn@1 as a card. Always returns a card with something in it: an answer, a contest, or a gap. */
export function renderAnswerCard(turn, { doc = document } = {}) {
  ensureStyle(doc);
  const m = answerCardModel(turn);
  const card = make(doc, "section", "answer-card is-" + m.kind);
  card.setAttribute("aria-label", "Answer");

  if (m.kind === "answer") {
    const line = make(doc, "p", "answer-text");
    marked(doc, line, m.headline.text, m.headline.bold, "strong");
    card.append(line);
    // the headline that IS the source sentence is the quote: it is not drawn a second time
    if (!m.quote.shownAsHeadline) card.append(quoteEl(doc, m.quote));
    if (m.cite) card.append(citeEl(doc, m.cite));
    card.append(make(doc, "div", "answer-checked", "Checked: " + (m.checked.length ? m.checked.join(" · ") : CHECKED_NONE)));
  } else if (m.kind === "contest") {
    const box = make(doc, "div", "answer-contest");
    box.setAttribute("role", "group"); box.setAttribute("aria-label", CONTEST_LABEL);
    box.append(make(doc, "p", "answer-contest-k", CONTEST_LABEL));
    const cols = make(doc, "div", "contest-cols");
    for (const c of m.contest) {
      const col = make(doc, "div", "contest-col");
      if (c.label) col.append(make(doc, "div", "contest-filler", c.label));
      col.append(quoteEl(doc, c.quote));
      if (c.cite) col.append(citeEl(doc, c.cite));
      cols.append(col);
    }
    box.append(cols); card.append(box);
  } else {
    card.append(gapEl(doc, m.gap));
  }

  if (m.unmeasured.length) card.append(make(doc, "div", "answer-unmeasured", "Not checked: " + m.unmeasured.join(" · ")));
  if (m.trace.length) card.append(traceEl(doc, m.trace));
  return card;
}

/** Append the card to an assistant message element when `msg.answerTurn` exists; a no-op (returns null) otherwise. Re-mounting replaces. */
export function mountAnswerCard(msgEl, msg) {
  if (!msgEl || !msg || !msg.answerTurn || typeof msg.answerTurn !== "object") return null;
  const doc = msgEl.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  for (const k of Array.from(msgEl.children || [])) if (k.classList?.contains("answer-card")) k.remove?.();
  const card = renderAnswerCard(msg.answerTurn, { doc });
  msgEl.append(card);
  return card;
}
