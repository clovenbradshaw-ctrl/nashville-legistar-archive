// fold-chat-presentview.js — draw an answer the way its turn went (fold-chat-present.js picks the layout), and
// replay how it got there: the question, the search, the page in its own type turning into EOT lines, the other
// sources, the sorting, the attempts to break it. The replay can be slowed to ½× or ¼×.
// DOM only; every string from a page or a record goes in as textContent.
import { typeOf, salientSentences, falsifiersOf, FALSIFIER_GRID } from "./fold-chat-present.js";
import { sha256Hex } from "./fold-chat-eot.js";
import { detectLang } from "./fold-chat-lang.js";
import { attribute, figuresIn, namesIn } from "./fold-chat-ground.js";
import { falsifyAnswer } from "./fold-chat-falsify-answer.js";
import { splitSentences } from "./vendor/khora/native/adapters/text/spans.js";
import { AUXILIARY_VERBS, DEFINITE_DETERMINERS, INDEFINITE_DETERMINERS, CLAUSE_COORDINATORS } from "./vendor/khora/native/adapters/text/priors.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const siteOf = (d) => String(d.title || "").split(" \u2014 ")[0] || d.domain || "source";
const pageOf = (d) => String(d.title || "").split(" \u2014 ").slice(1).join(" \u2014 ") || "";
const isHttp = (u) => /^https?:\/\//i.test(String(u || ""));
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "\u2026" : t; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const SPEEDS = [[1, "1\u00d7"], [0.5, "\u00bd\u00d7"], [0.25, "\u00bc\u00d7"]];
const G = { NUL: "\u2205", SIG: "\u25cb", INS: "\u25cf", SEG: "\uff5c", CON: "\u22c8", SYN: "\u25b3", DEF: "\u22a2", EVA: "\u22a8", REC: "\u25c9" };
const C = { NUL: "var(--dim)", SIG: "var(--link)", INS: "var(--ink)", SEG: "var(--ag)", CON: "var(--ag)", SYN: "var(--ag)", DEF: "var(--ink2)", EVA: "var(--ok)", REC: "var(--warn)" };
const TOKC = ["var(--ag)", "var(--link)", "var(--warn)"];

function fav(domain, name) {
  const ty = typeOf(domain);
  const f = el("span", "pv-fav", ty.fav || String(name || domain || "?").trim().charAt(0).toUpperCase());
  f.style.background = ty.favBg; f.style.color = ty.favFg; f.title = name || domain || "";
  return f;
}
function credit(d, extra = "") {
  const row = el("div", "pv-credit");
  row.append(fav(d.domain, siteOf(d)), el("b", "", siteOf(d)));
  if (d.domain) row.append(el("span", "pv-dom", d.domain));
  if (extra) row.append(el("span", "pv-x", extra));
  if (isHttp(d.url)) { const a = el("a", "", "open \u2197"); a.href = d.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", "Open " + siteOf(d) + " in a new tab"); row.append(a); }
  return row;
}
/** One passage, in its own site's type: the page title in the site's title face, the passage in its body face, the
 *  cited span marked. `words` splits the span into word spans the replay can light one by one. */
export function clipping(p, d, { compact = false, words = false } = {}) {
  const ty = typeOf(p.domain || d?.domain);
  const c = el("div", "pv-clip" + (compact ? " compact" : ""));
  if (p.n) c.dataset.tag = String(p.n);
  Object.assign(c.style, { background: ty.bg, color: ty.ink, borderColor: ty.edge });
  c.style.setProperty("--pv-mark", ty.mark);
  const title = d ? pageOf(d) : "";
  if (title && !compact) { const h = el("div", "pv-clip-t", title); Object.assign(h.style, { fontFamily: ty.title, fontWeight: ty.titleWeight, textTransform: ty.titleCase, letterSpacing: ty.titleTrack, borderBottomColor: ty.rule }); c.append(h); }
  const b = el("div", "pv-clip-b"); Object.assign(b.style, { fontFamily: ty.body, fontSize: ty.bodySize });
  if (!compact && p.ellipsisBefore) b.append("\u2026 ");
  if (!compact && p.before) b.append(p.before + " ");
  const m = el("mark");
  const span = String(p.mark || p.text || "");
  if (words) { for (const w of span.split(/(\s+)/)) { if (!w) continue; if (/^\s+$/.test(w)) m.append(w); else m.append(el("span", "pv-w", w)); } }
  else { m.textContent = span; m.style.background = ty.mark; }
  b.append(m);
  if (!compact && p.after) b.append(" " + p.after);
  if (!compact && p.ellipsisAfter) b.append(" \u2026");
  c.append(b);
  return c;
}

// The sources beyond the first, as doc-like rows: a cited document (with its passage) or a page that only gave the figure.
function othersOf(pres) {
  const out = [];
  const docs = pres.docs.slice(1).map((d) => ({ ...d, passage: d.passages[0] || null }));
  out.push(...docs);
  const ag = pres.agreement;
  if (ag && ag.groups.length === 1) {
    const have = new Set(pres.docs.map((d) => d.domain));
    for (const s of ag.groups[0].sources) if (!have.has(s.domain)) { have.add(s.domain); out.push({ title: s.ref || s.site, domain: s.domain, url: s.url, passage: null, gives: ag.groups[0].label }); }
  }
  return out;
}
function docFor(pres, s, label) {
  const d = pres.docs.find((x) => (s.domain && x.domain === s.domain) || (s.url && x.url === s.url));
  return d ? { ...d, passage: d.passages[0] || null } : { title: s.ref || s.site, domain: s.domain, url: s.url, passage: null, gives: label };
}
function otherEl(o) {
  const w = el("div", "pv-other");
  if (o.passage) w.append(clipping(o.passage, o, { compact: true }));
  w.append(credit(o, o.passage ? "" : o.gives ? "gives " + o.gives : ""));
  return w;
}

function sourcesEl(pres) {
  const { docs, layout, agreement: ag } = pres;
  const wrap = el("div", "pv-src");
  if (layout === "paraphrase") {
    wrap.append(el("div", "pv-k", "what it means, in the sources\u2019 own words"));
    for (const c of (pres.meanChecks || []).filter((x) => x.meaning && x.meaning.sourceSentence && x.meaning.level !== "none").slice(0, 4)) {
      const d = { title: c.ref || "", domain: domainOfUrl(c.source), url: c.source };
      const o = el("div", "pv-other"); o.append(clipping({ domain: d.domain, mark: clip(c.meaning.sourceSentence, 260) }, d, { compact: true }), credit(d, c.meaning.level === "same" ? "same claim" : "close")); wrap.append(o);
    }
    return wrap;
  }
  if (layout === "unsupported") {
    wrap.append(el("div", "pv-k", "what it read instead"));
    for (const p of (pres.readPassages || []).slice(0, 4)) { const d = { title: p.ref, domain: domainOfUrl(p.url), url: p.url }; const o = el("div", "pv-other"); o.append(clipping({ domain: d.domain, mark: clip(p.text, 220) }, d, { compact: true }), credit(d)); wrap.append(o); }
    if (!(pres.readPassages || []).length) wrap.hidden = true;
    return wrap;
  }
  if (layout === "creative") {
    // MARGINAL NOTES: what the piece drew on, small, numbered, each quote in its own site's face.
    if (!docs.length) { wrap.hidden = true; return wrap; }
    wrap.append(el("div", "pv-k", "drew on"));
    docs.slice(0, 6).forEach((d, i) => {
      const p = d.passages[0] || {};
      const n = el("div", "pv-margin");
      const ty = typeOf(d.domain);
      const q = el("span", "q", "\u201c" + clip(p.mark || p.text, 140) + "\u201d"); q.style.fontFamily = ty.body;
      const s = el("span", "s", siteOf(d));
      const body = el("span", "t"); body.append(s, " ", q);
      if (isHttp(d.url)) { const a = el("a", "", "\u2197"); a.href = d.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.setAttribute("aria-label", "Open " + siteOf(d)); body.append(" ", a); }
      n.append(el("span", "n", String(i + 1)), body);
      wrap.append(n);
    });
    return wrap;
  }
  const first = docs[0], p0 = first.passages[0];
  if (layout !== "book" && layout !== "mixed") wrap.append(el("div", "pv-k pv-src-k", layout === "one" ? "the source’s own words" : "the sources’ own words"));
  if (layout === "one") { wrap.append(credit(first), clipping(p0, first)); return wrap; }
  if (layout === "agree") {
    const others = othersOf(pres);
    const stack = el("div", "pv-stack");
    stack.append(clipping(p0, first), el("div", "pv-edge e1"), el("div", "pv-edge e2"));
    wrap.append(credit(first), stack);
    const said = ag ? `${others.length} more say the same` : `${plural(others.length, "more source")}`;
    const btn = el("button", "pv-more"); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
    const fv = el("span", "pv-favs"); for (const o of others.slice(0, 6)) fv.append(fav(o.domain, siteOf(o)));
    const lbl = el("span", "lbl", said); btn.append(fv, lbl);
    const list = el("div", "pv-list"); list.hidden = true;
    for (const o of others) list.append(otherEl(o));
    btn.onclick = () => { list.hidden = !list.hidden; stack.classList.toggle("open", !list.hidden); btn.setAttribute("aria-expanded", String(!list.hidden)); lbl.textContent = list.hidden ? said : `Hide the other ${others.length}`; };
    wrap.append(btn, list);
    return wrap;
  }
  if (layout === "split") {
    const chips = el("div", "pv-chips"), note = el("div", "pv-note"), list = el("div", "pv-list");
    const pick = (gi) => {
      [...chips.children].forEach((c, i) => { c.classList.toggle("on", i === gi); c.setAttribute("aria-pressed", String(i === gi)); });
      const g = ag.groups[gi], k = g.sources.length;
      note.textContent = g.value === ag.answer
        ? `${k === 1 ? "This page matches" : `These ${k} pages match`} the answer.`
        : `${k === 1 ? "This page gives" : `These ${k} pages give`} ${g.label}, not ${ag.answerLabel}. Check when ${k === 1 ? "it was" : "they were"} written, and what exactly is being measured.`;
      list.replaceChildren(...g.sources.map((s) => otherEl(docFor(pres, s, g.label))));
    };
    ag.groups.forEach((g, gi) => {
      const c = el("button", "pv-chip"); c.type = "button";
      const fv = el("span", "pv-favs"); for (const s of g.sources.slice(0, 4)) fv.append(fav(s.domain, s.site));
      c.append(fv, el("b", "", g.label), el("span", "c", "\u00b7 " + g.sources.length));
      c.onclick = () => pick(gi);
      chips.append(c);
    });
    wrap.append(chips, note, list);
    pick(0);
    return wrap;
  }
  if (layout === "book") {
    // THE SCENES IT RESTS ON: every scene the turn read from the book, in story order, each in the book's own type.
    // A scene the answer cites shows the cited words marked; one it read but did not cite is shown quieter.
    const b = pres.book || {};
    const scenes = Array.isArray(b.scenes) && b.scenes.length ? b.scenes : docs.map((d) => ({ ref: d.title, url: d.url, text: d.passages[0]?.text || "" }));
    const cited = scenes.filter((s) => docs.some((d) => d.url === s.url)).length;
    wrap.append(el("div", "pv-k", `what it rests on \u00b7 ${plural(scenes.length, "scene")} from ${b.title || siteOf(first)}`));
    if (b.paras) wrap.append(el("div", "pv-rest-sum", `Read all ${b.paras.toLocaleString("en")} paragraphs. ${b.matched} have ${(b.names || []).join(" and ")} together; these ${scenes.length} were given to the model${cited < scenes.length ? `, and the answer cites ${cited}` : ""}.`));
    const list = el("div", "pv-list pv-scenes");
    for (const s of scenes) {
      const d = docs.find((x) => x.url === s.url);
      const like = d || { title: s.ref, domain: "gutenberg.org", url: s.url };
      const o = el("div", "pv-other pv-scene" + (d ? " cited" : ""));
      o.append(d ? clipping(d.passages[0], like) : clipping({ domain: "gutenberg.org", before: clip(s.text, 320) }, like), credit(like, d ? d.passages[0].n : "read, not cited"));
      list.append(o);
    }
    wrap.append(list);
    return wrap;
  }
  // mixed: what the retelling rests on — the passages, each in its own type
  wrap.append(el("div", "pv-k", "what it rests on"));
  const all = docs.flatMap((d) => d.passages.slice(0, 2).map((p) => ({ d, p })));
  const list = el("div", "pv-list");
  all.forEach(({ d, p }, i) => { const o = el("div", "pv-other"); o.append(clipping(p, d, { compact: true }), credit(d, p.n)); if (i >= 2) o.hidden = true; list.append(o); });
  wrap.append(list);
  if (all.length > 2) {
    const more = el("button", "pv-line", `Show ${all.length - 2} more`); more.type = "button";
    more.onclick = () => { const hid = [...list.children].some((x) => x.hidden); [...list.children].forEach((x, i) => { if (i >= 2) x.hidden = !hid; }); more.textContent = hid ? "Show fewer" : `Show ${all.length - 2} more`; };
    wrap.append(more);
  }
  return wrap;
}

function checkRow(c) {
  const r = el("div", "pv-check" + (c.ok ? "" : " bad"));
  const t = el("span"); t.append(el("b", "", c.q), " ", el("span", "a", c.a));
  r.append(el("span", "i", c.ok ? "\u2713" : "!"), t);
  return r;
}
const FST = { held: ["\u2713", "held"], failed: ["\u2717", "failed"], gap: ["\u27c2", "gap"], refused: ["\u2731", "refused"], open: ["\u00b7", "not run"], "n/a": ["\u2013", "nothing to test"] };
const GRAINS = ["record", "claim", "across sources"];
/** Nine ways, one row each. Internally every row is three tests (Ground · Figure · Pattern); the row shows the worst of
 *  the three, and its line says the one that decided it. The three are in the row's tooltip and in the JSON log. */
function falsifyEl(rows, open = false) {
  const wrap = el("div", "pv-fals");
  const RANK = { failed: 5, refused: 4, gap: 3, held: 2, open: 1, "n/a": 0 };
  const decide = (r) => { const cs = [r.ground, r.figure, r.pattern].map((c, i) => ({ ...(c || { status: "open", found: "" }), i })); const w = cs.reduce((x, y) => (RANK[y.status] > RANK[x.status] ? y : x)); if (w.status !== "held") return w; return r.figure && r.figure.status !== "held" ? { ...r.figure, i: 1 } : { ...r.figure, i: 1, status: "held" }; };
  const rowsD = rows.map((r) => ({ r, d: decide(r) }));
  const bad = rowsD.filter((x) => x.d.status === "failed").length, flag = rowsD.filter((x) => x.d.status === "gap" || x.d.status === "refused").length;
  const head = el("button", "pv-fals-h"); head.type = "button"; head.setAttribute("aria-expanded", String(!!(open || bad || flag)));
  const strip = el("span", "strip");
  for (const { r, d } of rowsD) { const c = el("span", "c s-" + d.status.replace("/", ""), G[r.op]); c.title = `${r.op} \u00b7 ${FST[d.status][1]}`; strip.append(c); }
  head.append(el("b", "", "Tried to break it nine ways"), strip, el("span", "sum", bad ? `${bad} failed` : flag ? `${flag} flagged` : "held"));
  const list = el("div", "pv-fals-l"); list.hidden = !(open || bad || flag);
  for (const [ri, { r, d }] of rowsD.entries()) {
    const row = el("div", "pv-fal s-" + d.status.replace("/", ""));
    row.append(el("span", "g", G[r.op]), el("span", "op", r.op));
    const t = el("span", "t"); t.append(el("b", "", r.q), " ", el("span", "f", d.found + (d.i !== 1 && d.status !== "held" ? ` (${GRAINS[d.i]})` : "")));
    row.append(t, el("span", "st", FST[d.status][0] + " " + FST[d.status][1]));
    row.title = [r.ground, r.figure, r.pattern].map((c, i) => `${GRAINS[i]}: ${(FALSIFIER_GRID[ri] || [])[i] || ""} \u2014 ${FST[c?.status || "open"][1]}${c?.found ? ", " + c.found : ""}`).join("\n") + "\nWhat would falsify it: " + r.test;
    list.append(row);
  }
  head.onclick = () => { list.hidden = !list.hidden; head.setAttribute("aria-expanded", String(!list.hidden)); };
  wrap.append(head, list);
  return wrap;
}
function checksEl(pres, { open = false } = {}) {
  const { checks, contested, layout } = pres;
  if (pres.falsifiers) return falsifyEl(pres.falsifiers, open);
  const wrap = el("div", "pv-checks");
  if (layout === "creative") {
    wrap.append(el("div", "pv-creative-line", pres.docs.length ? `Creative writing \u00b7 nothing here is fact-checked \u00b7 drew on ${plural(pres.docs.length, "source")}` : "Creative writing \u00b7 nothing here is fact-checked"));
    return wrap;
  }
  const list = el("div", "pv-checks-l");
  for (const c of checks) list.append(checkRow(c));
  if (open || layout === "split" || layout === "mixed" || layout === "book" || layout === "paraphrase" || contested) { wrap.append(el("div", "pv-checks-h", `I tried to prove this wrong ${checks.length} ways`), list); return wrap; }
  const b = el("button", "pv-line"); b.type = "button"; b.setAttribute("aria-expanded", "false");
  b.append(el("span", "ok", "\u2713"), ` Held up against ${plural(checks.length, "check")} \u00b7 `, el("u", "", "see them"));
  list.hidden = true;
  b.onclick = () => { list.hidden = !list.hidden; b.setAttribute("aria-expanded", String(!list.hidden)); };
  wrap.append(b, list);
  return wrap;
}

function answerEl(rec, content, pres, mdHtml) {
  if (pres.layout === "paraphrase") {
    const box = el("div", "pv-para");
    const md = el("div", "ganswer md"); md.innerHTML = mdHtml(content);
    box.append(md);
    return box;
  }
  if (pres.layout === "unsupported") {
    const box = el("div", "pv-unsup");
    const ban = el("div", "pv-unsup-h");
    ban.append(el("b", "", "\u2731 Nothing it read supports this answer"), el("span", "", `It read ${plural(pres.read || 0, "page")}, then wrote from its own memory. Treat every claim below as unchecked.`));
    if (pres.onSourcesOnly) { const b = el("button", "pv-btn", "Answer again from the sources only"); b.type = "button"; b.onclick = pres.onSourcesOnly; ban.append(b); }
    const md = el("div", "ganswer md pv-unsup-t"); md.innerHTML = mdHtml(content);
    box.append(ban, md); return box;
  }
  if (pres.layout === "creative") { const md = el("div", "pv-prose md"); md.innerHTML = mdHtml(content); return md; }
  if (pres.layout !== "mixed") { const md = el("div", "ganswer md"); md.innerHTML = mdHtml(content); return md; }
  const box = el("div", "pv-answer-mixed");
  const a = el("div", "pv-mixed");
  for (const r of rec.facing.response || []) {
    const s = el("span", r.grounded ? "pv-s-src" : "pv-s-imag", r.text);
    a.append(s);
    if (r.grounded) a.append(el("sup", "pv-tag", r.tag));
    a.append(" ");
  }
  box.append(a, el("div", "pv-legend", "plain = from the sources \u00b7 dotted = imagined"));
  return box;
}

let armed = null;
/** The live panel just ended at tape time `t`: the next presented answer picks the tape up from there. */
// tap a clamped source excerpt (narrow screens) to read all of it, tap again to fold it back
if (typeof document !== "undefined" && !globalThis.__pvClipTap) { globalThis.__pvClipTap = true; document.addEventListener("click", (e) => { const b = e.target.closest && e.target.closest(".pv-src .pv-clip-b"); if (b) b.classList.toggle("open"); }); }
export const armTailReplay = (t = 0) => { armed = { at: Date.now(), t }; };

/** Draw the presented answer into `body`. */
export function renderPresented(body, { rec, content, pres, mdHtml, question = "", senses = null, model = null }) {
  const box = el("div", "pv pv-" + (pres.register || "research"));
  box.dataset.layout = pres.layout;
  const pres2 = rec.book ? { ...pres, book: rec.book } : { ...pres };
  if (pres2.layout !== "creative" && pres2.layout !== "unsupported") pres2.falsifiers = falsifiersOf(rec, { meanChecks: pres2.meanChecks, fz: pres2.fz });
  // AT REST: the answer and one summary line. Sources, checks and process live in one inspector the line opens;
  // the answer's own sentences carry the evidence (a dotted underline = no passage backs it; click one to see why).
  // The answer on the left, the sources' own words on the right (stacked when the column is narrow).
  const face = el("div", "pv-face");
  const ans = el("div", "pv-ans");
  if (senses) ans.append(senses);
  const answer = answerEl(rec, content, pres2, mdHtml);
  ans.append(answer);
  const src = sourcesEl(pres2);
  face.append(ans, src);
  const insp = inspectorEl(rec, pres2, question, model, box, !src.hidden);
  markSentences(answer, rec, pres2, insp);
  box.append(face);
  // The replay lives behind one small "watch" on the summary line; the strip itself stays hidden.
  if (Array.isArray(rec.tape) && rec.tape.length) {
    const slot = el("div", "pv-rp-slot"); slot.hidden = true;
    const strip = tapeStrip(rec, question, slot); strip.hidden = true;
    const w = el("button", "pv-sum-b pv-watch", "\u25b6 watch"); w.type = "button";
    w.onclick = () => { if (strip.classList.contains("open")) { slot.hidden = true; strip.classList.remove("open"); w.textContent = "\u25b6 watch"; } else { strip.open(0, { autoplay: true, foldAtEnd: true }); w.textContent = "\u25a0 hide"; } };
    insp.line.append(w); box.append(strip, slot);
  }
  box.append(insp.line, insp.panel);
  body.append(box);
  armed = null;
  return box;
}

/** One inspector per turn: a summary line whose parts open a tabbed panel (Sources · Checks · Process). */
function inspectorEl(rec, pres, question, model, root, hasSrc) {
  const { layout } = pres;
  const line = el("div", "pv-sum");
  const panel = el("div", "pv-insp"); panel.hidden = true;
  const tabs = el("div", "pv-tabs"); tabs.setAttribute("role", "tablist");
  panel.append(tabs);
  const T = [];
  const add = (key, label, pane, sum, warn = false) => {
    const tab = el("button", "pv-tab", label); tab.type = "button"; tab.setAttribute("role", "tab");
    tab.onclick = () => select(key);
    tabs.append(tab);
    const p = el("div", "pv-pane"); p.setAttribute("role", "tabpanel"); p.append(pane); p.hidden = true; panel.append(p);
    const b = el("button", "pv-sum-b" + (warn ? " warn" : "") + (key === "proc" ? " proc" : ""), sum); b.type = "button"; b.setAttribute("aria-expanded", "false");
    b.onclick = () => toggle(key);
    if (line.childElementCount) line.append(el("span", "pv-sum-dot", "\u00b7"));
    line.append(b);
    T.push({ key, tab, p, b });
  };
  let cur = null;
  const paint = () => T.forEach((t) => { const on = !panel.hidden && t.key === cur; t.tab.setAttribute("aria-selected", String(t.key === cur)); t.p.hidden = t.key !== cur; t.b.setAttribute("aria-expanded", String(on)); });
  const select = (key) => { cur = key; panel.hidden = false; paint(); };
  const toggle = (key) => { if (!panel.hidden && cur === key) { panel.hidden = true; paint(); } else select(key); };
  const x = el("button", "pv-tab-x", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Close");
  x.onclick = () => { panel.hidden = true; paint(); };

  // SOURCES: drawn on the right of the answer; the line only counts them
  const n = pres.counts?.sentences || 0, g = pres.counts?.grounded || 0;
  let srcSum = null, srcWarn = false;
  if (layout === "unsupported") { srcSum = `read ${plural(pres.read || 0, "page")} \u00b7 none back the answer`; srcWarn = true; }
  else if (layout === "paraphrase") srcSum = null;
  else if (layout === "creative") srcSum = pres.docs.length ? `drew on ${plural(pres.docs.length, "source")}` : null;
  else { srcSum = plural(pres.docs.length, "source") + (n ? ` \u00b7 ${g} of ${plural(n, "sentence")} backed` : ""); srcWarn = n > 0 && g < n; }
  if (srcSum && hasSrc) line.append(el("span", "pv-sum-k" + (srcWarn ? " warn" : ""), srcSum));
  if (rec.loop && rec.loop.passes?.length) { if (line.childElementCount) line.append(el("span", "pv-sum-dot", "\u00b7")); line.append(el("span", "pv-sum-k", `went back ${plural(rec.loop.passes.length, "lap")}`)); }

  // CHECKS
  if (layout === "creative") { line.prepend(el("span", "pv-sum-k", "creative writing \u00b7 not fact-checked")); if (line.childElementCount > 1) line.children[0].after(el("span", "pv-sum-dot", "\u00b7")); }
  else {
    let bad = 0, flag = 0, total = 0;
    if (pres.falsifiers) {
      total = pres.falsifiers.length;
      for (const r of pres.falsifiers) { const st = [r.ground, r.figure, r.pattern].map((c) => c?.status); if (st.includes("failed")) bad++; else if (st.includes("gap") || st.includes("refused")) flag++; }
    } else { total = (pres.checks || []).length; bad = (pres.checks || []).filter((c) => !c.ok).length; }
    if (total) { const cp = el("div", "pv-insp-chk"); if (rec.loop && rec.loop.passes?.length) cp.append(loopEl(rec.loop)); if (pres.fz && pres.fz.sources.length && pres.fz.claims.length) cp.append(crossRefEl(pres.fz)); cp.append(checksEl(pres, { open: true })); add("chk", "Checks", cp, bad ? `${bad} of ${plural(total, "check")} failed` : flag ? `${flag} of ${plural(total, "check")} flagged` : `held ${plural(total, "check")}`, !!(bad || flag)); }
  }

  // PROCESS: the log and (moved in by fold-chat.js) the steps / web reads / route
  const proc = el("div", "pv-insp-proc");
  if ((Array.isArray(rec.tape) && rec.tape.length) || rec.facing) proc.append(logButton(rec, question));
  const done = Array.isArray(rec.feed) ? rec.feed.find((e) => e && e.op === "done") : null;
  const procSum = done ? String(done.title || "").split(" \u00b7 ")[0].replace(/^Answered in /, "") : "process";
  const meta = [rec.effort ? "effort " + rec.effort : null, model || rec.model || null].filter(Boolean).join(" \u00b7 ");
  if (meta) proc.append(el("div", "pv-proc-meta", meta));
  add("proc", "Process", proc, procSum);

  tabs.append(x);
  cur = T[0]?.key || null;
  paint();
  const clips = () => [...root.querySelectorAll(".pv-src .pv-clip[data-tag]")];
  return {
    line, panel,
    has: (key) => (key === "src" ? hasSrc : T.some((t) => t.key === key)),
    open: (key) => { if (T.some((t) => t.key === key)) select(key); },
    hit: (tags, on) => { const set = new Set(tags); for (const c of clips()) c.classList.toggle("pv-hit", !!on && (c.dataset.tag.match(/S\d+/gi) || [c.dataset.tag]).some((t) => set.has(t.toUpperCase()))); },
  };
}

/** THE EVIDENCE ON HOVER (the holograph's rule: every part points at the whole). Point at an answer sentence and the page it rests on speaks in its own
 *  words: the source, then the sentence the cross-reference found STATING it, verbatim, with a link to the page. A sentence nothing states says only that.
 *  No marks sit on the text; the popover is the only chrome, and it appears only when asked for (hover, focus, or a tap on touch). */
function evidenceOf(rec, pres, idx, r) {
  const out = [];
  const c = pres.fz?.claims?.[idx];
  for (const w of (c?.witnesses || [])) {
    if (w.verdict !== "states" && w.verdict !== "contradicts") continue;
    const src = (pres.fz.sources || []).find((x) => x.key === w.src) || {};
    out.push({ quote: String(w.sentence || ""), domain: src.domain || "", title: src.ref || "", url: src.url || null, kind: w.verdict });
  }
  if (!out.length) {
    const fs = rec?.facing?.sources || [];
    for (const t of (String(r?.tag || "").match(/S\d+/gi) || [])) { const sx = fs.find((x) => String(x.n).toUpperCase() === t.toUpperCase()); if (sx && (sx.mark || sx.text)) out.push({ quote: String(sx.mark || sx.text), domain: sx.domain || "", title: sx.label || "", url: sx.url || null, kind: "states" }); }
  }
  const seen = new Set();
  return out.filter((e) => e.quote && !seen.has(e.quote) && seen.add(e.quote)).sort((a, b) => (a.kind === "states" ? 0 : 1) - (b.kind === "states" ? 0 : 1)).slice(0, 3);
}
// THE PAGE BEHIND THE QUOTE: the text the turn kept of a source (record.passages, the tape's quick reads, attached material), cut into short passages
// the person can step through. Only what was kept is shown; if that is just the cited sentence, it says so.
const normUrl = (u) => String(u || "").replace(/#.*$/, "").replace(/\/$/, "");
function pageTextOf(rec, url) {
  const U = normUrl(url), parts = [];
  const add = (t) => { t = String(t || "").trim(); if (t.length > 40 && !parts.some((x) => x.includes(t) || t.includes(x))) parts.push(t); };
  for (const p of rec?.passages || []) if (U && normUrl(p.url || p.source) === U) add(p.text);
  for (const e of rec?.tape || []) if (e && e.kind === "quick" && e.p && U && normUrl(e.p.url) === U) add(e.p.text);
  for (const m of rec?.material || []) if (m && m.text && U && normUrl(m.url || m.source) === U) add(m.text);
  return parts.join("\n\n");
}
function chunksOf(text) {
  const out = [];
  for (const para of String(text).split(/\n{2,}/)) {
    let sents; try { sents = splitSentences(para).map((x) => (x.text ?? para.slice(x.start, x.end)).trim()); } catch { sents = para.split(/(?<=[.!?])\s+/); }
    sents = sents.filter(Boolean);
    for (let i = 0; i < sents.length; i += 3) out.push(sents.slice(i, i + 3).join(" "));
  }
  return out.slice(0, 60);
}
/** The expandable page: prev / next through its passages, the cited one marked with a bar (no highlighter). */
function pageView(rec, it, quote) {
  const box = el("div", "pv-ev-page");
  const text = pageTextOf(rec, it.url);
  const chunks = chunksOf(text);
  const q = String(quote || "").replace(/\s+/g, " ").replace(/[\u2026.]+$/, "").trim();
  const key = q.slice(0, 40).toLowerCase();
  let cited = chunks.findIndex((c) => c.replace(/\s+/g, " ").toLowerCase().includes(key));
  if (!chunks.length || cited < 0) {
    box.append(el("div", "pv-ev-note", chunks.length ? "The cited sentence is not in the part of the page this turn kept." : "Only the cited sentence was kept from this page; open it to read the rest."));
    return box;
  }
  let cur = cited;
  const nav = el("div", "pv-ev-nav");
  const prev = el("button", "pv-ev-prev", "\u2039"); prev.type = "button"; prev.setAttribute("aria-label", "Previous passage");
  const next = el("button", "pv-ev-next", "\u203a"); next.type = "button"; next.setAttribute("aria-label", "Next passage");
  const pos = el("span", "pv-ev-pos"); const home = el("button", "pv-ev-home", "back to the quote"); home.type = "button";
  nav.append(prev, pos, next, home);
  const scroller = el("div", "pv-ev-scroll");
  const ps = chunks.map((c, i) => {
    const p = el("div", "pv-ev-p" + (i === cited ? " cited" : "")); p.dataset.i = String(i);
    if (i === cited) { const flat = c.replace(/\s+/g, " "); const at = flat.toLowerCase().indexOf(key); const end = Math.min(flat.length, at + Math.max(q.length, 0)); p.append(flat.slice(0, at), el("b", "", flat.slice(at, end)), flat.slice(end)); } else p.textContent = c;
    p.onclick = () => go(i);
    scroller.append(p); return p;
  });
  const go = (i, smooth = true) => { cur = Math.max(0, Math.min(chunks.length - 1, i)); ps.forEach((p, k) => p.classList.toggle("cur", k === cur)); pos.textContent = `${cur + 1} / ${chunks.length}`; prev.disabled = cur === 0; next.disabled = cur === chunks.length - 1; home.hidden = cur === cited; const t = ps[cur]; if (t) scroller.scrollTo({ top: Math.max(0, t.offsetTop - scroller.offsetTop - 6), behavior: smooth ? "smooth" : "auto" }); };
  prev.onclick = () => go(cur - 1); next.onclick = () => go(cur + 1); home.onclick = () => go(cited);
  scroller.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); } if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); } });
  scroller.tabIndex = 0;
  box.append(nav, scroller);
  requestAnimationFrame(() => go(cited, false));
  return box;
}
let popEl = null, scrimEl = null, popTimer = 0, popFor = null, popPinned = false;
const sheetMode = () => { try { return matchMedia("(hover: none)").matches || innerWidth < 700; } catch { return false; } };
function hidePop(now = false) { clearTimeout(popTimer); if (popPinned && !now) return; const go = () => { popPinned = false; if (popEl) { popEl.hidden = true; popFor = null; } if (scrimEl) scrimEl.hidden = true; }; if (now) go(); else popTimer = setTimeout(go, 160); }
/** One sentence as the stage draws it: who | does | what, in labelled boxes. A box lights when it names something the other sentence's matching box names. */
function tripleRow(t, ref) {
  const row = el("div", "pv-ev-trip");
  const has = (keys, refKeys) => !!ref && keys.some((k) => refKeys.includes(k));
  const mk = (cls, lab, text, hit) => { if (!text) return; const b = el("div", "pv-ev-b " + cls + (hit ? " hit" : "")); b.append(el("span", "tx", clip(text, 58)), el("i", "lb", lab)); row.append(b); };
  mk("s", "SUBJ", t.e1, ref && has(t.k1, [...ref.k1, ...ref.k2])); mk("v", "VERB", t.rel, ref && has(t.kr, ref.kr)); mk("o", "OBJ", t.e2, ref && has(t.k2, [...ref.k1, ...ref.k2]));
  return row;
}
function showPop(span, items, { answer = "", sheet = false, rec = null } = {}) {
  clearTimeout(popTimer);
  if (!popEl) {
    popEl = el("div", "pv-pop"); popEl.setAttribute("role", "dialog"); popEl.setAttribute("aria-label", "Where this sentence comes from"); popEl.hidden = true; document.body.append(popEl);
    scrimEl = el("div", "pv-pop-scrim"); scrimEl.hidden = true; scrimEl.addEventListener("click", () => hidePop(true)); document.body.append(scrimEl);
    popEl.addEventListener("mouseenter", () => clearTimeout(popTimer)); popEl.addEventListener("mouseleave", () => { if (!popEl.classList.contains("sheet")) hidePop(); });
    addEventListener("scroll", (e) => { if (!popEl.classList.contains("sheet") && !popEl.contains(e.target)) hidePop(true); }, true); addEventListener("keydown", (e) => { if (e.key === "Escape") hidePop(true); });
    document.addEventListener("click", (e) => { if (popPinned && popEl && !popEl.hidden && !popEl.contains(e.target) && !(popFor && popFor.contains(e.target))) hidePop(true); });
  }
  popEl.className = "pv-pop" + (sheet ? " sheet" : "");
  popPinned = false;
  popEl.replaceChildren();
  if (sheet) { const bar = el("div", "pv-pop-bar"); const x = el("button", "pv-pop-x", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = () => hidePop(true); bar.append(el("span", "grip"), x); popEl.append(bar); }
  const at = answer ? tripleOf(answer) : null;
  if (at) { const a = el("div", "pv-ev-ans"); a.append(el("div", "pv-ev-k", "this sentence"), tripleRow(at, null)); popEl.append(a); }
  if (!items.length) { const n = el("div", "pv-pop-none"); n.append(el("b", "", "No source states this"), el("span", "", "nothing it read says this sentence")); popEl.append(n); }
  // WHERE IT CAME FROM leads each card: the page's favicon, its domain, whether it says this or says otherwise, a link; then the sentence as the
  // stage cuts it (who | does | what), then the verbatim words. Several quotes from one page sit under one header.
  const groups = [];
  for (const it of items) { const k = (it.url || it.domain || "") + "|" + it.kind; let g = groups.find((x) => x.k === k); if (!g) groups.push(g = { k, it, quotes: [] }); g.quotes.push(it.quote); }
  groups.forEach(({ it, quotes }, gi) => {
    const dom = String(it.domain || "").replace(/^www\./, "");
    const ttl = String(it.title || "").replace(/^[^\u2014\u2013|]*\.(?:org|com|net|gov|edu|co\.uk|io)\s*[\u2014\u2013|-]\s*/i, "").trim();   // "en.wikipedia.org — History of the telephone" -> the page title alone
    const row = el("div", "pv-pop-row" + (gi === 0 ? " first" : ""));
    const src = el("div", "pv-pop-src");
    src.append(fav(it.domain || "", it.title || dom), el("b", "", dom || "a page"));
    if (ttl && ttl !== dom) src.append(el("span", "t", ttl));
    src.append(el("span", "rel " + (it.kind === "contradicts" ? "bad" : "ok"), it.kind === "contradicts" ? "says otherwise" : "says this"));
    if (it.url && /^https?:\/\//i.test(it.url)) { const a = el("a", "o", "open \u2197"); a.href = it.url; a.target = "_blank"; a.rel = "noopener"; src.append(a); }
    row.append(src);
    let pageBox = null;
    const more = el("button", "pv-ev-more", "Show the page"); more.type = "button"; more.setAttribute("aria-expanded", "false");
    const toggle = () => {
      if (pageBox) { pageBox.remove(); pageBox = null; more.textContent = "Show the page"; more.setAttribute("aria-expanded", "false"); return; }
      pageBox = pageView(rec, it, quotes[0]); row.append(pageBox); more.textContent = "Hide the page"; more.setAttribute("aria-expanded", "true"); popPinned = true; clearTimeout(popTimer);
      if (!popEl.classList.contains("sheet")) { const pr = popEl.getBoundingClientRect(); if (pr.bottom > innerHeight - 8) popEl.style.top = Math.max(8, innerHeight - 8 - pr.height) + "px"; }
    };
    more.onclick = toggle;
    for (const q of quotes.slice(0, 2)) {
      let tr = null; try { tr = tripleRow(tripleOf(q), at); } catch {}
      if (tr) { for (const b of tr.querySelectorAll(".pv-ev-b")) { b.tabIndex = 0; b.setAttribute("role", "button"); b.title = "Show the page this is from"; b.onclick = toggle; b.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }; } row.append(tr); }
      row.append(el("q", it.kind === "contradicts" ? "bad" : "", q));
    }
    row.append(more);
    popEl.append(row);
  });
  popEl.hidden = false; popFor = span; if (scrimEl) scrimEl.hidden = !sheet;
  if (!sheet) {
    popEl.style.left = popEl.style.top = "0px";
    const r = span.getBoundingClientRect(), pr = popEl.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, innerWidth - pr.width - 8));
    const below = r.bottom + 6 + pr.height <= innerHeight - 8;
    popEl.style.left = left + "px"; popEl.style.top = Math.max(8, below ? r.bottom + 6 : r.top - pr.height - 6) + "px";
  } else { popEl.style.left = popEl.style.top = ""; }
}

/** The evidence on the sentences: each answer sentence the record scored gets a span — backed (quiet; hover lights its
 *  passage, click opens Sources) or not (dotted; click opens Checks). Best effort: a sentence that crosses inline
 *  formatting is marked up to the first boundary. */
function markSentences(root, rec, pres, insp) {
  const resp = pres.response || rec?.facing?.response;
  if (!Array.isArray(resp) || !resp.length || rec.creative || rec.noClaims) return;
  if (pres.layout === "unsupported" || pres.layout === "mixed" || pres.layout === "creative") return;
  const textNodes = () => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest(".pv-sen,.senses,code,pre") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) }); const a = []; while (w.nextNode()) a.push(w.currentNode); return a; };
  resp.forEach((r, idx) => {
    const t = String(r.text || "").replace(/\s+/g, " ").trim();
    if (t.length < 8) return;
    const key = t.slice(0, 48);
    const node = textNodes().find((nd) => nd.data.includes(key));
    if (!node) return;
    const at = node.data.indexOf(key);
    const range = document.createRange();
    range.setStart(node, at); range.setEnd(node, Math.min(node.data.length, at + t.length));
    const v = pres.fz?.claims[idx]?.verdict;
    const kind = v === "contested" ? "contested" : v === "weak" ? "weak" : (r.grounded || v === "corroborated" || v === "held") ? "ok" : "no";
    const span = el("span", "pv-sen " + kind);
    try { range.surroundContents(span); } catch { return; }
    const tags = (String(r.tag || "").match(/S\d+/gi) || []).map((s) => s.toUpperCase());
    const items = evidenceOf(rec, pres, idx, r);
    span.tabIndex = 0; span.setAttribute("role", "button"); span.setAttribute("aria-haspopup", "dialog");
    const ctx = () => ({ answer: String(r.text || ""), sheet: sheetMode(), rec });
    span.addEventListener("mouseenter", () => { if (!sheetMode()) { showPop(span, items, ctx()); if (kind === "ok" && insp.has("src")) insp.hit(tags, true); } });
    span.addEventListener("mouseleave", () => { if (!sheetMode()) { hidePop(); insp.hit(tags, false); } });
    span.addEventListener("focus", () => { if (!sheetMode()) showPop(span, items, ctx()); });
    span.addEventListener("blur", () => { if (!sheetMode()) hidePop(); });
    span.addEventListener("click", () => { if (sheetMode()) { popFor === span && popEl && !popEl.hidden ? hidePop(true) : showPop(span, items, ctx()); } else if (insp.has("chk") && kind !== "ok") insp.open("chk"); });
  });
}

/** THE REC LOOP, as it ran: each lap, which sentences broke, the search each went back with, what was read, what was restated. */
function loopEl(loop) {
  const wrap = el("div", "pv-loop");
  wrap.append(el("div", "pv-k", `went back \u00b7 ${plural(loop.passes.length, "lap")} \u00b7 ${loop.cleared ? "every sentence holds" : "some still fail, marked in the answer"}`));
  for (const p of loop.passes) {
    const lap = el("div", "pv-lap");
    lap.append(el("span", "n", "\u25c9 " + p.lap));
    const body = el("div", "b");
    for (const f of p.failing) {
      const r = el("div", "r");
      const re = (p.restated || []).find((x) => x.i === f.i);
      r.append(el("b", "", `s${f.i + 1} ${f.verdict}`), ` \u2192 ${f.why}.`);
      if (f.afterIns === "holds") r.append(el("span", "ok", " Found in the pages already read."));
      else r.append(` Searched \u201c${f.query}\u201d.`);
      if (re && re.to) r.append(el("span", "ok", ` Restated: \u201c${clip(re.to, 160)}\u201d (${re.verdict}).`));
      else if (re) r.append(el("span", "no", ` Kept and marked: ${re.why}.`));
      body.append(r);
    }
    body.append(el("div", "m", [(p.reImpressed || []).length ? `${plural(p.reImpressed.length, "new impression")} from pages already read (${p.reImpressed.map((x) => `${x.segments} of the page\u2019s sentences recalled`).join(", ")})` : "pages already read: nothing more", p.added ? `read ${plural(p.added, "more source")}` : null].filter(Boolean).join(" \u00b7 ")));
    lap.append(body);
    wrap.append(lap);
  }
  return wrap;
}

const XV = { corroborated: ["corroborated", "ok"], held: ["one source", "ok"], weak: ["weak", "warn"], contested: ["contested", "bad"], unsupported: ["no source", "bad"], "n/a": ["\u2013", ""] };
const XC = { states: "\u2713", contradicts: "\u2717", near: "~", silent: "\u00b7" };
/** THE CROSS-REFERENCE: every sentence of the answer (rows) against every source read (columns). */
function crossRefEl(fz) {
  const srcs = fz.sources.slice(0, 8);
  const wrap = el("div", "pv-xref");
  wrap.append(el("div", "pv-k", `cross-referenced \u00b7 ${plural(fz.claims.length, "sentence")} \u00d7 ${plural(fz.sources.length, "source")}`));
  const t = el("div", "pv-xref-t"); t.style.gridTemplateColumns = `minmax(0, 1fr) repeat(${srcs.length}, 28px) auto`;
  t.append(el("span", "h"));
  for (const s of srcs) { const h = el("span", "h c"); h.append(fav(s.domain, String(s.ref || s.key).split(" \u2014 ")[0])); h.title = s.ref || s.key; t.append(h); }
  t.append(el("span", "h"));
  for (const c of fz.claims) {
    const q = el("span", "q"); q.append(el("b", "", "s" + (c.i + 1)), " " + clip(c.s, 120)); t.append(q);
    for (const s of srcs) {
      const w = c.witnesses.find((x) => x.src === s.key) || { verdict: "silent" };
      const cell = el("span", "c v-" + w.verdict + (w.sameChainAs ? " chain" : ""), XC[w.verdict] || "\u00b7");
      cell.title = `${String(s.ref || s.key).split(" \u2014 ")[0]} \u00b7 ${w.verdict}${w.why ? ": " + w.why : ""}${w.sameChainAs ? " \u00b7 same wording as " + w.sameChainAs + ", counted once" : ""}${w.sentence && w.verdict !== "silent" ? "\n\u201c" + clip(w.sentence, 220) + "\u201d" : ""}`;
      t.append(cell);
    }
    const [lbl, tone] = XV[c.verdict] || [c.verdict, ""];
    const v = el("span", "v " + tone, lbl);
    v.title = c.swap.armed ? `swap test: “${c.swap.from}” \u2192 “${c.swap.to}” ${c.swap.discriminates ? "no longer matches (the source tells them apart)" : "still matches (the source does not tell them apart)"}` : "swap test: nothing to swap";
    t.append(v);
  }
  wrap.append(t, el("div", "pv-xref-n", "\u2713 states it \u00b7 \u2717 contradicts it \u00b7 ~ close, but a figure or name is missing \u00b7 \u00b7 silent. Hover a cell for the source\u2019s sentence."));
  return wrap;
}

function replayBar(rec, pres, question, slot) {
  const bar = el("div", "pv-replay-bar");
  let speed = 1; try { speed = Number(localStorage.getItem("fold-chat:replaySpeed")) || 1; } catch {}
  let player = null;
  const go = el("button", "pv-btn", "\u21bb Watch how I got here"); go.type = "button";
  const sp = el("div", "pv-speed"); sp.setAttribute("role", "group"); sp.setAttribute("aria-label", "Replay speed");
  const bs = SPEEDS.map(([v, label]) => { const b = el("button", "", label); b.type = "button"; b.onclick = () => { speed = v; try { localStorage.setItem("fold-chat:replaySpeed", String(v)); } catch {} paint(); if (player) player.setSpeed(v); }; return b; });
  sp.append(...bs);
  const paint = () => bs.forEach((b, i) => { b.classList.toggle("on", SPEEDS[i][0] === speed); b.setAttribute("aria-pressed", String(SPEEDS[i][0] === speed)); });
  go.onclick = () => { if (!player) player = mountReplay(slot, rec, pres, question, () => { go.textContent = "\u21bb Watch how I got here"; }); player.play(speed); go.textContent = "\u21bb Replay"; };
  paint();
  bar.append(go, sp);
  return bar;
}

const norm = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
const STOP = new Set("the a an and or of to in on at by for with from that this is was were are be as it its into than then his her their he she they which who".split(" "));
/** Up to three words of the passage the answer's sentence also uses: figures first, then names, then long words. */
function sharedTokens(sentence, words) {
  const S = new Set(String(sentence || "").split(/\s+/).map(norm).filter(Boolean));
  const seen = new Set();
  const c = words.map((w, i) => ({ i, n: norm(w), w })).filter((x) => x.n.length > 2 && S.has(x.n) && !STOP.has(x.n) && !seen.has(x.n) && seen.add(x.n));
  const rank = (x) => (/\d/.test(x.n) ? 0 : /^\p{Lu}/u.test(x.w) ? 1 : 2) * 100 - x.n.length;
  return c.sort((a, b) => rank(a) - rank(b)).slice(0, 3).sort((a, b) => a.i - b.i).map((x) => x.i);
}

/** The replay: one panel, every element carrying the time it appears (data-at) and, for panes that give way, the
 *  time it leaves (data-until). One clock; a slower speed stretches the clock and the transitions together. */
function mountReplay(slot, rec, pres, question, onClose) {
  const STG = [];
  const stage = (at, op, say) => STG.push({ at, op, say });
  const at = (node, a, until = null) => { node.dataset.at = a.toFixed(3); if (until != null) node.dataset.until = until.toFixed(3); return node; };
  const eot = (a, op, text, bar = "") => {
    const r = el("div", "pv-eot"); const b = el("span", "bar"); if (bar) b.style.background = bar;
    const g = el("span", "g", G[op]); g.style.color = C[op];
    const tx = el("span"); const o = el("b", "", op); o.style.color = C[op]; tx.append(o, " " + text);
    r.append(b, g, tx); return at(r, a);
  };
  const rp = el("div", "pv-rp");
  const head = el("div", "pv-rp-h"); const hg = el("span", "pv-rp-g"); const say = el("span", "pv-rp-say"); const hop = el("span", "pv-rp-op");
  const x = el("button", "pv-rp-x", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Close the replay");
  head.append(hg, say, hop, x);
  const cols = el("div", "pv-rp-cols"); const L = el("div", "pv-rp-l"); const R = el("div", "pv-rp-r");
  R.append(el("div", "pv-k", "EOT, as it\u2019s written"));
  cols.append(L, R);
  let t = 0;

  stage(0, "NUL", "Reading your question");
  const q = at(el("div", "pv-rp-pane"), 0, 0.9);
  q.append(el("div", "pv-k", "your question"), el("div", "pv-rp-q", question || "(the ask)"), at(el("span", "pv-rp-chip", pres.layout === "book" ? "a question about a book \u00b7 it needs the text itself" : pres.layout === "mixed" ? "part fact, part invention \u00b7 the facts need sources" : "a question of fact \u00b7 it needs a source"), 0.35));
  L.append(q);
  R.append(eot(0.2, "NUL", `ask : question \u00b7 ${pres.layout === "mixed" ? "retell" : "fact"}`));

  t = 0.9; stage(t, "SIG", "Looking for sources");
  const web = Array.isArray(rec.web) ? rec.web : [];
  const searches = web.filter((w) => (w.engine || w.scope) && !w.read).slice(0, 6);
  const reads = web.filter((w) => w.read && !w.skipped && w.ok !== false).length || pres.docs.length;
  const s = at(el("div", "pv-rp-pane"), t);
  s.append(el("div", "pv-k", "where I looked"));
  searches.forEach((w, i) => { const r = at(el("div", "pv-rp-row"), t + 0.15 + i * 0.14); r.append(el("b", "", w.engine || w.scope), el("span", "", w.ok === false ? "failed" + (w.why ? ": " + clip(w.why, 30) : "") : w.n != null ? plural(w.n, "result") : "")); s.append(r); });
  const t2 = t + 0.2 + searches.length * 0.14;
  s.append(at(el("div", "pv-rp-row pv-rp-sum", `read ${plural(reads, "page")}`), t2));
  t = t2 + 0.6; s.dataset.until = t.toFixed(3); L.append(s);

  const d0 = pres.docs[0], p0 = d0.passages[0];
  stage(t, "SIG", `Finding the part of ${siteOf(d0)} that answers you`);
  const rd = at(el("div", "pv-rp-pane"), t);
  rd.append(el("div", "pv-k", "the page, in its own type"), clipping(p0, d0, { words: true }), credit(d0));
  const words = [...rd.querySelectorAll(".pv-w")];
  const sweep = 1.2;
  words.forEach((w, i) => { w.dataset.lit = (t + 0.35 + sweep * (i / Math.max(1, words.length))).toFixed(3); });
  const sid = "src_" + sha256Hex(String(d0.url || d0.domain || d0.title)).slice(0, 6);
  R.append(eot(t, "NUL", `${sid} : source \u00b7 ${d0.domain || siteOf(d0)}`));
  R.append(eot(t + 0.7, "SIG", `${p0.n} \u00b7 chars ${p0.span?.start ?? "?"}\u2013${p0.span?.end ?? "?"}`));
  let tt = t + 0.35 + sweep + 0.25;
  stage(tt, "INS", "Keeping it, word for word, as EOT");
  const resp = rec.facing.response || [];
  const sent = resp.find((r) => r.grounded && r.tag === p0.n) || resp.find((r) => r.grounded) || resp[0];
  R.append(eot(tt, "INS", `c1 : claim \u00b7 \u201c${clip(sent?.text, 48)}\u201d`)); tt += 0.45;
  R.append(eot(tt, "CON", `c1.src -> ${sid}#${p0.span?.start ?? "?"}-${p0.span?.end ?? "?"}`)); tt += 0.45;
  sharedTokens(sent?.text, words.map((w) => w.textContent)).forEach((wi, k) => {
    const w = words[wi]; w.dataset.ul = tt.toFixed(3); w.style.setProperty("--pv-ulc", TOKC[k]);
    R.append(eot(tt, "DEF", `c1.says = \u201c${w.textContent.replace(/[^\p{L}\p{N}.,'\u2019-]+/gu, "")}\u201d`, TOKC[k])); tt += 0.45;
  });
  R.append(eot(tt, "EVA", `${p0.n} occurs word for word in the page \u2713`)); tt += 0.7;
  rd.dataset.until = tt.toFixed(3); L.append(rd);
  t = tt;

  const rest = (pres.layout === "split" ? pres.agreement.groups.flatMap((g) => g.sources.map((x) => docFor(pres, x, g.label))) : othersOf(pres))
    .filter((o) => o.domain !== d0.domain || pres.layout === "book").filter((o) => o.url !== d0.url).slice(0, 6);
  if (rest.length) {
    stage(t, "INS", `Reading ${plural(rest.length, "more source")}`);
    R.append(at(el("div", "pv-k pv-rp-sub", "what I kept"), t));
    let last = null;
    rest.forEach((o, i) => {
      const a = t + i * 0.4;
      const pane = at(el("div", "pv-rp-pane"), a, a + 0.4);
      pane.append(el("div", "pv-k", "the page, in its own type"), o.passage ? clipping(o.passage, o) : el("div", "pv-rp-q", `${siteOf(o)} gives ${o.gives || "the same"}.`), credit(o));
      L.append(pane); last = pane;
      const line = at(el("div", "pv-led"), a + 0.15);
      line.append(fav(o.domain, siteOf(o)), el("span", "", `c${i + 2} \u00b7 ${o.gives ? "value = " + o.gives : (o.passage?.n || "passage")} \u00b7 ${o.domain || siteOf(o)}`));
      R.append(line);
    });
    t += rest.length * 0.4 + 0.3;
    if (last) last.dataset.until = t.toFixed(3);
  }

  if (pres.layout === "split") {
    const ag = pres.agreement;
    stage(t, "SEG", "Sorting what they say");
    const so = at(el("div", "pv-rp-pane"), t);
    so.append(el("div", "pv-k", "sorting"), el("div", "pv-rp-q", `${plural(ag.groups.reduce((n, g) => n + g.sources.length, 0), "page")}, ${ag.groups.length} different values.`));
    L.append(so);
    ag.groups.forEach((g, i) => R.append(eot(t + 0.3 + i * 0.35, "SEG", `${g.label} \u00b7 ${plural(g.sources.length, "page")}${g.value === ag.answer ? " \u00b7 the answer's" : ""}`, g.value === ag.answer ? "var(--ok)" : "var(--warn)")));
    t += 0.4 + ag.groups.length * 0.35 + 0.4;
    so.dataset.until = t.toFixed(3);
  }

  stage(t, "EVA", "Trying to prove it wrong");
  const cp = at(el("div", "pv-rp-pane"), t);
  cp.append(el("div", "pv-k", "trying to prove it wrong"));
  pres.checks.forEach((c, i) => cp.append(at(checkRow(c), t + 0.3 + i * 0.45)));
  L.append(cp);
  t += 0.3 + pres.checks.length * 0.45 + 0.3;
  stage(t, "SYN", "Writing the answer from what held up");
  R.append(eot(t + 0.2, "SYN", `answer \u2190 ${plural(pres.counts.grounded, "kept claim")}${pres.layout === "mixed" ? ` + ${pres.counts.sentences - pres.counts.grounded} imagined` : ""}`));
  t += 0.9;
  stage(t, "DEF", "Done");
  const END = t + 0.1;

  const scrub = el("div", "pv-scrub"); const track = el("div", "track"); const fill = el("div", "track fill");
  scrub.append(track, fill);
  const dots = STG.map((st) => { const d = el("button", "pv-dot"); d.type = "button"; d.title = st.say; d.style.left = (st.at / END) * 100 + "%"; d.append(el("i"), el("span", "", G[st.op])); d.onclick = () => seek(st.at); scrub.append(d); return d; });
  rp.append(head, cols, scrub);
  slot.replaceChildren(rp);

  const nodes = [...rp.querySelectorAll("[data-at]")], lit = [...rp.querySelectorAll("[data-lit]")], uls = [...rp.querySelectorAll("[data-ul]")];
  let T = 0, speed = 1, raf = 0, lastNow = 0;
  function render() {
    for (const n of nodes) { const a = +n.dataset.at, u = n.dataset.until != null ? +n.dataset.until : Infinity; n.classList.toggle("pv-on", T >= a && T < u); }
    for (const w of lit) w.classList.toggle("lit", T >= +w.dataset.lit);
    for (const w of uls) w.classList.toggle("ul", T >= +w.dataset.ul);
    const st = [...STG].reverse().find((z) => T >= z.at) || STG[0];
    hg.textContent = G[st.op]; hg.style.color = C[st.op]; say.textContent = st.say; hop.textContent = st.op;
    fill.style.width = Math.min(100, (T / END) * 100) + "%";
    dots.forEach((d, i) => d.classList.toggle("on", T >= STG[i].at));
  }
  let onEnd = null;
  function frame(now) {
    if (!rp.isConnected || slot.hidden) { raf = 0; return; }
    const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
    T = Math.min(END, T + dt * speed); render();
    raf = T < END ? requestAnimationFrame(frame) : 0;
    if (!raf && onEnd) { const f = onEnd; onEnd = null; f(); }
  }
  const run = () => { lastNow = performance.now(); if (!raf) raf = requestAnimationFrame(frame); };
  function seek(a) { T = a; render(); run(); }
  x.onclick = () => { slot.hidden = true; if (raf) cancelAnimationFrame(raf); raf = 0; onClose && onClose(); };
  return {
    play(v, from = 0, end = null) { speed = v; onEnd = end; rp.style.setProperty("--pv-k", String(v)); slot.hidden = false; T = from; render(); run(); },
    at(op) { const st = STG.find((z) => z.op === op); return st ? st.at : 0; },
    close() { x.onclick(); },
    setSpeed(v) { speed = v; rp.style.setProperty("--pv-k", String(v)); },
  };
}


// ════════════════ THE TAPE ════════════════
// Every turn that reads sources records a TAPE of plain entries { at (s), seq, kind, … }. The live panel is a player of
// that tape on the real clock; the replay is the same player over the stored tape, at any speed down to 1/20×.
//
// THE NINE LEVELS, in the order the work really happens:
//   NUL hold      the question is held and classified                      (live: the turn starts)
//   SIG notice    sources are searched; results come back                   (live: the search)
//   INS mint      pages are read; passages kept — the parts with your words (live: the reads)
//   SEG segment   related sentences from different sources: words, parts, subject | verb | object
//   CON bond      the things they name are linked through their verbs
//   SYN compose   one graph across the sources — and the model writes from it (the answer streams above)
//   DEF define    each sentence of the answer becomes a claim
//   EVA evaluate  each claim is matched, word by word, against what was read; the longest shared run decides
//   REC reframe   what stands, what is weak, what has no source — the answer's frame
const HELIX = ["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"];
const LEVEL = ["hold", "notice", "mint", "segment", "bond", "compose", "define", "evaluate", "reframe"];
const PREP = new Set(["of", "in", "to", "with", "by", "for", "on", "at", "from", "as", "into", "over", "after", "before", "during", "through", "about", "against", "between", "under", "without", "within"]);
const PRON = new Set(["i", "you", "he", "she", "it", "we", "they", "this", "that", "these", "those", "who", "which", "its", "their", "his", "her", "what", "why", "how", "when", "where"]);
const FUNC = new Set([...AUXILIARY_VERBS, ...DEFINITE_DETERMINERS, ...INDEFINITE_DETERMINERS, ...CLAUSE_COORDINATORS, ...PREP, ...PRON]);
const bare = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
const domainOfUrl = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const sidOf = (s) => "src_" + sha256Hex(String(s)).slice(0, 6);
const slimP = (p) => ({ text: clip(p.text, 900), ref: p.ref || "", url: p.url || p.source || "" });
const slimSt = (s) => { const o = {}; for (const k of ["phase", "scope", "q", "n", "url", "site", "title", "chars", "kept", "why", "text"]) if (s[k] != null) o[k] = s[k]; return o; };
const stripMd = (s) => String(s).replace(/[*_#>`]+/g, "").replace(/^\s*([-•]|\d+\.)\s+/gm, "");
const askWords = (q) => (String(q).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !FUNC.has(w));
const sentencesOf = (text) => stripMd(String(text).replace(/\s*\[(?:W|S|M)\d*\]/g, "")).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 14);
const VIEW_KEY = "fold-chat:processView";
const viewMode = () => { try { return localStorage.getItem(VIEW_KEY) === "quiet" ? "quiet" : "full"; } catch { return "full"; } };

function tagOf(tok, i) {
  const w = bare(tok);
  if (!w) return "punct";
  if (/^\d/.test(w)) return "num";
  if (DEFINITE_DETERMINERS.has(w) || INDEFINITE_DETERMINERS.has(w)) return "det";
  if (AUXILIARY_VERBS.has(w)) return "aux";
  if (PREP.has(w)) return "prep";
  if (CLAUSE_COORDINATORS.has(w)) return "conj";
  if (PRON.has(w)) return "pron";
  if (i > 0 && /^\p{Lu}/u.test(tok.replace(/^[^\p{L}]+/u, ""))) return "name";
  if (/(ed|ing)$/.test(w) && w.length > 4) return "verb";
  return "word";
}
/** The slow read: from up to three sources (different sites), the sentence in each that bears most on the ask; each
 *  sentence's words and parts; its subject / verb / object; and the GRAPH they make — entity nodes (merged when two
 *  sentences name the same thing) joined by the verbs. Deterministic, so a replay rebuilds exactly what the live saw. */
function deriveGraph(list, question) {
  const qWords = new Set((String(question).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !FUNC.has(w)));
  const rows = [];
  for (const p of list.slice(0, 3)) {
    const text = clip(p.text, 900);
    let sents = [];
    try { sents = splitSentences(text).map((x) => (x.text ?? text.slice(x.start, x.end)).trim()); } catch { sents = []; }
    if (!sents.length) sents = text.split(/(?<=[.!?])\s+/);
    sents = sents.filter((x) => x.length > 24 && x.length < 320);
    if (!sents.length) continue;
    const sentence = salientSentences(text, question, 1)[0] || sents[0];
    const toks = sentence.split(/\s+/).filter(Boolean).slice(0, 26);
    const tags = toks.map((t, i) => tagOf(t, i));
    let v = tags.findIndex((t, i) => i > 0 && (t === "aux" || t === "verb"));
    if (v < 1) v = Math.min(2, toks.length - 1);
    let vEnd = v + 1; while (vEnd < toks.length && (tags[vEnd] === "verb" || (tags[v] === "aux" && tags[vEnd] === "aux"))) vEnd++;
    if (tags[v] === "aux" && vEnd < toks.length && tags[vEnd] === "word" && /(ed|en|ing|s)$/.test(bare(toks[vEnd]))) vEnd++;
    let sC = 0, oC = 0;
    const roles = toks.map((t, i) => {
      if (i >= v && i < vEnd) return "v";
      const fn = FUNC.has(bare(t)) || tags[i] === "punct";
      if (i < v) { if (fn) return "f"; return ++sC <= 4 ? "s" : "x"; }
      if (fn) return "f"; return ++oC <= 5 ? "o" : "x";
    });
    let lang = "unknown"; try { lang = detectLang(text).name || "unknown"; } catch {}
    rows.push({ site: siteOf({ title: p.ref }), domain: domainOfUrl(p.url), url: p.url, sentence, toks, tags, roles, lang });
  }
  const nodes = [], edges = [];
  const keysOf = (r, role) => r.toks.filter((t, i) => r.roles[i] === role).map(bare).filter((w) => w.length >= 4);
  const nodeFor = (r, role, ri) => {
    const keys = keysOf(r, role);
    const label = r.toks.filter((t, i) => r.roles[i] === role).join(" ");
    if (!label) return null;
    const hit = nodes.find((n) => keys.some((k) => k.length >= 5 && n.keys.includes(k)));
    if (hit) { hit.rows.push(ri); return hit; }
    const n = { id: "n" + (nodes.length + 1), label, keys, rows: [ri], role, ask: keys.some((k) => qWords.has(k)) };
    nodes.push(n); return n;
  };
  rows.forEach((r, ri) => {
    r.nS = nodeFor(r, "s", ri); r.nO = nodeFor(r, "o", ri);
    const verb = r.toks.filter((t, i) => r.roles[i] === "v").join(" ");
    if (r.nS && r.nO) edges.push({ id: "e" + (edges.length + 1), from: r.nS.id, to: r.nO.id, verb, row: ri, ask: r.nS.ask || r.nO.ask || keysOf(r, "v").some((k) => qWords.has(k)) });
  });
  const shared = [...new Set(rows.flatMap((r) => r.toks.map(bare)))].filter((w) => qWords.has(w));
  return { rows, nodes, edges, shared, q: [...qWords].slice(0, 6) };
}
/** The panels: a header line (what it is doing now — the whole view when the workings are hidden), then three columns
 *  of FIXED height — 1 what it's doing · 2 the nine levels over the content · 3 the EOT ledger. */
function buildPanels() {
  const rp = el("div", "pv-rp pv-live" + (viewMode() === "quiet" ? " quiet" : ""));
  const head = el("div", "pv-rp-h"); const hg = el("span", "pv-rp-g"); const say = el("span", "pv-rp-say"); const hop = el("span", "pv-rp-op");
  const tog = el("button", "pv-tog"); tog.type = "button";
  const paintTog = () => { const q = rp.classList.contains("quiet"); tog.textContent = q ? "show" : "hide"; tog.title = q ? "Show the workings" : "Hide the workings"; tog.setAttribute("aria-pressed", String(!q)); };
  tog.onclick = () => { const q = !rp.classList.contains("quiet"); try { localStorage.setItem(VIEW_KEY, q ? "quiet" : "full"); } catch {} for (const r of document.querySelectorAll(".pv-live")) { r.classList.toggle("quiet", q); r.querySelector(".pv-tog")?.dispatchEvent(new Event("paint")); } };
  tog.addEventListener("paint", paintTog); paintTog();
  head.append(hg, say, hop, tog);
  const cols = el("div", "pv-live-cols");
  const D = el("div", "pv-live-d"); const dlog = el("div", "pv-live-log pv-doing");
  D.append(el("div", "pv-k", "1 \u00b7 what it\u2019s doing"), dlog);
  const M = el("div", "pv-live-m");
  const levels = el("div", "pv-levels");
  HELIX.forEach((o, i) => { const c = el("span", "pv-lv", G[o]); c.title = `${i + 1} \u00b7 ${o} \u00b7 ${LEVEL[i]}`; c.setAttribute("aria-label", c.title); levels.append(c); });
  const L = el("div", "pv-mid");
  const F = el("div", "pv-ph-host");
  const foot = el("div", "pv-ph-foot");
  M.append(levels, L, F, foot);
  const R = el("div", "pv-rp-r pv-live-r"); const rlog = el("div", "pv-live-log");
  R.append(el("div", "pv-k", "3 \u00b7 the EOT ledger"), rlog);
  // ONE PANEL: the doing log and the EOT ledger are still kept (the replay and the JSON log read them) but not shown as
  // columns; the frame shows the work, and its foot carries the latest step and ledger lines.
  cols.append(M); rp.append(head, cols);
  const setLevel = (k) => [...levels.children].forEach((c, i) => { c.classList.toggle("on", i === k); c.classList.toggle("done", i < k); });
  // THE ONE ANIMATION: REC sending the turn back. An arc runs from ◉ back to ○ over the nine levels, the levels between
  // light in reverse order, and a line says which sentences broke. Everything else in the panel is still.
  const loopFx = (lap, failing = []) => {
    M.querySelector(".pv-loopfx")?.remove(); M.querySelector(".pv-fwdfx")?.remove();
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    // geometry from the real chips: the amber arc runs from the \u25c9 chip back to the \u25cf chip; the teal rail then runs forward from \u25cf to \u25c9
    const lr = levels.getBoundingClientRect(), W = Math.max(1, lr.width || levels.clientWidth || 900), sc = (levels.offsetWidth || W) ? W / (levels.offsetWidth || W) : 1;
    const cx = (i) => { const c = levels.children[i]; if (!c) return (W / 9) * (i + 0.5); const r = c.getBoundingClientRect(); return (r.left - lr.left + r.width / 2) / sc; };
    const xb = cx(8), xa = cx(2);
    const fx = el("div", "pv-loopfx");
    const lab = el("div", "pv-loop-l"); lab.append(`\u25c9 lap ${lap} \u00b7 ${failing.map((f) => `s${f.i + 1} ${f.verdict}`).join(", ") || "a sentence broke"} \u2014 back to \u25cf INS, `); const fw = el("span", "fw", "then forward from there"); lab.append(fw);
    const svg = mk("svg", { viewBox: `0 0 ${W} 34`, preserveAspectRatio: "none", "aria-hidden": "true" });
    svg.append(mk("path", { d: `M${xb},33 C${xb},2 ${xa},2 ${xa},31`, class: "arc", pathLength: "100" }), mk("path", { d: `M${xa - 6},24 L${xa},33 L${xa + 6},24`, class: "tip" }));
    fx.append(lab, svg);
    M.insertBefore(fx, levels);
    const fwd = el("div", "pv-fwdfx");
    const s2 = mk("svg", { viewBox: `0 0 ${W} 14`, preserveAspectRatio: "none", "aria-hidden": "true" });
    s2.append(mk("path", { d: `M${xa},7 L${xb - 1},7`, class: "rail", pathLength: "100" }), mk("path", { d: `M${xb - 8},1 L${xb},7 L${xb - 8},13`, class: "tip" }));
    fwd.append(s2);
    levels.after(fwd);
    // the levels light in order, forward, once the arc has landed
    [...levels.children].forEach((c, i) => { c.classList.remove("back"); if (i >= 2) { void c.offsetWidth; c.style.setProperty("--d", (0.95 + (i - 2) * 0.13).toFixed(2) + "s"); c.classList.add("back"); } });
    setLevel(2);
  };
  return { rp, hg, say, hop, dlog, L, F, foot, rlog, setLevel, loopFx };
}
const newCtx = (question) => ({ question, drows: new Map(), rows: new Map(), looked: null, srcs: 0, g: null, material: [], level: -1 });

/** Apply one tape entry. No timers: motion comes from CSS on the nodes it inserts or moves. */
function applyEntry(P, en, ctx) {
  const stage = (op, text) => {
    P.hg.textContent = G[op]; P.hg.style.color = C[op]; P.hop.textContent = op;
    if (P.say.textContent !== text) { P.say.textContent = text; P.say.classList.remove("pv-fade"); void P.say.offsetWidth; P.say.classList.add("pv-fade"); }
  };
  const level = (k) => { if (k > ctx.level || k === 0) { ctx.level = k; P.setLevel(k); } };
  let nth = 0;
  const eot = (op, text, bar = "") => {
    const r = el("div", "pv-eot pv-in"); const b = el("span", "bar"); if (bar) b.style.background = bar;
    r.style.animationDelay = `calc(${(nth++ * 0.14).toFixed(2)}s / var(--pv-k, 1))`;
    const g = el("span", "g", G[op]); g.style.color = C[op];
    const tx = el("span"); const o = el("b", "", op); o.style.color = C[op]; tx.append(o, " " + text);
    r.append(b, g, tx); P.rlog.append(r);
    while (P.rlog.children.length > 300) P.rlog.firstChild.remove();
    if (P.rlog.scrollHeight - P.rlog.scrollTop - P.rlog.clientHeight < 80 || P.rp.classList.contains("pv-instant")) P.rlog.scrollTop = P.rlog.scrollHeight;
  };
  const view = (label) => { const p = el("div", "pv-view pv-in"); if (label) p.append(el("div", "pv-k", label)); P.L.replaceChildren(p); ctx.looked = null; if (ctx.g) ctx.g.live = false; return p; };
  const TONE = { ok: "var(--ok)", bad: "var(--bad)", info: "var(--dim)", warn: "var(--warn)", run: "var(--link)" };
  const drow = (id, title, tone = "run") => {
    let r = id ? ctx.drows.get(id) : null;
    if (!r) { r = el("div", "pv-do pv-in"); r.append(el("i", "dot"), el("span", "t"), el("span", "n")); P.dlog.append(r); if (id) ctx.drows.set(id, r); while (P.dlog.children.length > 14) P.dlog.firstChild.remove(); }
    if (title) r.querySelector(".t").textContent = title;
    r.querySelector(".dot").style.background = TONE[tone] || TONE.info;
    r.classList.toggle("running", tone === "run");
    return r;
  };
  const ask = new Set(askWords(ctx.question));
  switch (en.kind) {
    case "start": {
      level(0); stage("NUL", "Reading your question");
      const p = view("your question, held");
      const q = el("div", "pv-qtiles");
      String(ctx.question).split(/\s+/).filter(Boolean).forEach((w, i) => { const t = el("span", "pv-tile " + (ask.has(bare(w)) ? "pv-t-name" : "pv-t-det")); t.style.animationDelay = i * 60 + "ms"; t.append(el("span", "w", w), el("span", "l", ask.has(bare(w)) ? "look for" : "frame")); q.append(t); });
      p.append(q, el("div", "pv-gcap", ask.size ? `what it is about: ${[...ask].join(", ")} \u2014 everything it reads is held against these things` : "a short question \u2014 it carries what the conversation was about"));
      eot("NUL", `ask : question \u00b7 \u201c${clip(ctx.question, 40)}\u201d`);
      break;
    }
    case "ev": {
      const e = en.e || {};
      // EVERY real action lands in the ledger too, under the operator it is
      if ((e.op === "end" || e.op === "line") && e.title) {
        const t = e.title, note = e.note ? " \u00b7 " + clip(e.note, 44) : "";
        const op = /^(Read your question|Picked|Gemma|Loading|Model|.*ready in this tab)/i.test(t) ? "NUL"
          : /^(Searched|Asked)/i.test(t) ? null
          : /^(Chose where|Set aside|Read look-alike|Skipped|Dropped)/i.test(t) ? "SEG"
          : /^(Followed on|Carried)/i.test(t) ? "CON"
          : /^(Read |Opened|Kept|Used .*summary|Read all)/i.test(t) ? "INS"
          : /^(Could not|Couldn|The search failed)/i.test(t) ? "EVA"
          : /^(Wrote|Writing)/i.test(t) ? "SYN"
          : /^(Checked|Withdrew|Removed|Flagged)/i.test(t) ? "EVA"
          : "NUL";
        if (op) eot(op, `${clip(t, 52)}${note}`, e.tone === "bad" ? "var(--bad)" : e.tone === "warn" ? "var(--warn)" : "");
      }
      if (e.op === "begin") drow(e.id, e.title, "run");
      else if (e.op === "note") { const r = ctx.drows.get(e.id); if (r) r.querySelector(".n").textContent = clip(e.text, 70); }
      else if (e.op === "end") { const r = drow(e.id, e.title || null, e.tone === "bad" ? "bad" : e.tone === "info" ? "info" : "ok"); r.querySelector(".n").textContent = [e.ms >= 1000 ? (e.ms / 1000).toFixed(1) + "s" : "", e.note ? clip(e.note, 60) : ""].filter(Boolean).join(" \u00b7 "); }
      else if (e.op === "line") { const r = drow(null, e.title, e.tone === "bad" ? "bad" : e.tone === "warn" ? "warn" : e.tone === "info" ? "info" : "ok"); if (e.note) r.querySelector(".n").textContent = clip(e.note, 70); }
      break;
    }
    case "st": {
      const st = en.st || {};
      const name = String(st.scope || st.site || "").replace(/^./, (c) => c.toUpperCase());
      const lookRow = (key, nm) => {
        if (!ctx.looked || !ctx.looked.isConnected) { ctx.looked = view("where it\u2019s looking"); ctx.rows = new Map(); }
        if (!ctx.rows.has(key)) { const r = el("div", "pv-rp-row pv-in"); r.append(el("b", "", nm), el("span", "", "searching\u2026")); ctx.looked.append(r); ctx.rows.set(key, r); }
        return ctx.rows.get(key);
      };
      if (st.phase === "searching") { level(1); stage("SIG", `Searching ${st.scope === "web" ? "the web" : name}`); lookRow(st.scope, st.scope === "web" ? "The web" : name); eot("SIG", `search \u00b7 ${st.scope} ? \u201c${clip(st.q || ctx.question, 30)}\u201d`); }
      else if (st.phase === "found") { level(1); stage("SIG", `${name} answered with ${plural(Number(st.n) || 0, "result")}`); const r = lookRow(st.scope, name); r.lastChild.textContent = plural(Number(st.n) || 0, "result"); eot("NUL", `${st.scope} \u2192 ${plural(Number(st.n) || 0, "result")}`); }
      else if (st.phase === "failed") { const r = lookRow(st.scope, name); r.lastChild.textContent = "failed"; stage("SIG", `${name} failed \u2014 trying elsewhere`); eot("SIG", `${st.scope} \u00b7 failed`, "var(--warn)"); }
      else if (st.phase === "reading") {
        level(2); stage("INS", `Reading ${st.site || domainOfUrl(st.url) || "a page"}`);
        const d = { title: (st.site || domainOfUrl(st.url)) + (st.title ? " \u2014 " + st.title : ""), domain: domainOfUrl(st.url), url: st.url };
        const p = view("a page, as it arrives");
        const ty = typeOf(d.domain);
        const card = el("div", "pv-clip"); Object.assign(card.style, { background: ty.bg, color: ty.ink, borderColor: ty.edge });
        if (st.title) { const h = el("div", "pv-clip-t", clip(st.title, 90)); Object.assign(h.style, { fontFamily: ty.title, fontWeight: ty.titleWeight, textTransform: ty.titleCase, letterSpacing: ty.titleTrack, borderBottomColor: ty.rule }); card.append(h); }
        const bars = el("div", "pv-clip-b pv-bars"); for (const w of [92, 78, 86, 60]) { const b = el("i"); b.style.width = w + "%"; b.style.background = ty.edge; bars.append(b); } card.append(bars);
        p.append(card, credit(d));
        eot("NUL", `${sidOf(st.url)} : source \u00b7 ${d.domain}`);
      }
      break;
    }
    case "book": {
      level(2); stage("INS", `Reading all of ${en.title}`);
      const p = view("the book, whole");
      p.append(el("div", "pv-rp-q", `${en.matched} of ${en.paras.toLocaleString("en")} paragraphs have ${en.names.join(" and ")} together, across ${en.chapters} chapters.`));
      eot("INS", `${sidOf(en.url)} : source \u00b7 ${en.title}, whole text`);
      break;
    }
    case "quick": {
      level(2);
      const ps = en.p, d = { title: ps.ref || "", domain: domainOfUrl(ps.url), url: ps.url };
      stage("INS", `Keeping the part of ${siteOf(d)} that is about your question`);
      const p = view(`passages kept \u00b7 ${en.n} of ${en.of}`);
      const c = clipping({ domain: d.domain, mark: clip(ps.text, 300) }, d, { words: true });
      for (const w of c.querySelectorAll(".pv-w")) if (ask.has(bare(w.textContent))) w.classList.add("askw");
      p.append(c, credit(d));
      const ws = [...c.querySelectorAll(".pv-w")];
      ws.forEach((w, k) => { w.style.transitionDelay = (k * (650 / Math.max(1, ws.length))).toFixed(0) + "ms"; });
      if (P.rp.classList.contains("pv-instant")) ws.forEach((w) => w.classList.add("lit"));
      else requestAnimationFrame(() => requestAnimationFrame(() => ws.forEach((w) => w.classList.add("lit"))));
      ctx.srcs = Math.max(ctx.srcs, en.n);
      ctx.material.push({ ref: ps.ref || d.domain, source: ps.url, text: ps.text });
      const hits = ws.filter((w) => w.classList.contains("askw")).map((w) => bare(w.textContent));
      eot("INS", `S${en.n} : passage \u00b7 ${clip(siteOf(d), 22)}${hits.length ? " \u00b7 has " + [...new Set(hits)].slice(0, 2).join(", ") : ""}`, TOKC[en.n % 3]);
      break;
    }
    case "deep": tokenStage(P, en, ctx, { stage, eot, view, level }); break;
    case "writing": {
      level(5);
      // by:"model" writes from the graph; by:"mechanical" (a Sources-only turn, no model) must not claim a model wrote it
      const mech = en.by === "mechanical";
      stage("SYN", mech ? "Drawing the answer from the sources \u2014 no model wrote this" : "Writing the answer from this graph \u2014 it appears above");
      if (ctx.g && ctx.g.stageEl.isConnected) ctx.g.cap.textContent = mech ? "these are the sources' own passages, unchanged \u2014 no model wrote this answer" : "the model is writing from this graph now \u2014 the answer streams in above, and every sentence of it will be checked next";
      eot("SYN", `answer \u2190 ${plural(en.srcs || 0, "passage")}`);
      break;
    }
    case "check": checkStage(P, en, ctx, { stage, eot, view, level }); break;
    case "draft": {
      level(5);
      stage("SYN", `Writing \u2014 sentence ${en.i + 1} drafted`);
      if (!ctx.draftList || !ctx.draftList.isConnected) { const p = view("the answer, as it is written"); ctx.draftList = el("div", "pv-drafts"); p.append(ctx.draftList, el("div", "pv-gcap", "each sentence the model finishes appears here, with the parts of the graph it uses \u2014 it is checked word by word once the answer is done")); }
      const words = new Set(String(en.s).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
      const used = ctx.g ? ctx.g.G.nodes.filter((n) => n.keys.some((k2) => words.has(k2))) : [];
      const r = el("div", "pv-draft pv-in");
      const txt = el("span", "s"); r.append(el("b", "", "s" + (en.i + 1)), txt);
      const chips = el("span", "u");
      if (used.length) for (const n of used.slice(0, 3)) chips.append(el("i", "", clip(n.label, 22)));
      else chips.append(el("em", "", "uses nothing in the graph"));
      r.append(chips);
      ctx.draftList.append(r);
      while (ctx.draftList.children.length > 5) ctx.draftList.firstChild.remove();
      // type the sentence in, a few characters at a time, stretched by the replay speed
      const k = parseFloat(getComputedStyle(P.rp).getPropertyValue("--pv-k")) || 1;
      if (P.rp.classList.contains("pv-instant")) txt.textContent = en.s;
      else { let n = 0; const step = () => { if (!txt.isConnected) return; n = Math.min(en.s.length, n + 3); txt.textContent = en.s.slice(0, n); if (n < en.s.length) setTimeout(step, 22 / k); }; step(); }
      eot("SYN", `s${en.i + 1} drafted \u00b7 ${used.length ? "uses " + used.map((n) => n.id).join(", ") : "uses nothing in the graph"}`, used.length ? "var(--ag)" : "var(--warn)");
      break;
    }
    case "loop": {
      stage("REC", `Going back \u2014 lap ${en.lap}: ${plural((en.failing || []).length, "sentence")} broke`);
      P.loopFx(en.lap, en.failing || []); ctx.level = 2;
      for (const f of en.failing || []) eot("REC", `s${f.i + 1} ${f.verdict} \u2192 INS \u00b7 recall \u201c${clip(f.query, 40)}\u201d`, "var(--warn)");
      break;
    }
    case "done": stage("DEF", "Done \u2014 the answer is above"); break;
  }
  try { paintPhase(P, en, ctx); } catch (err) { try { console.warn("[fold-chat] phase frame:", err); } catch {} }
}

// ───────── THE NINE FRAMES: the middle panel, one visual register per level ─────────
// NUL type · SIG a ruled list · INS paper · SEG brackets · CON a graph · SYN dark, lit path · DEF a ledger · EVA a diff ·
// REC a matrix. Drawn from the tape's own data (ctx), so live and replay draw the same frames. A frame enters when its
// level begins (the only motion besides the REC arc); inside a level it is redrawn in place, still.
const KC = ["var(--ag)", "var(--link)", "var(--warn)"];
const stemK = (w) => bare(w).slice(0, 5);
function keyed(text, keys, cls = "") {
  const s = el("span", cls);
  for (const part of String(text || "").split(/(\s+)/)) {
    if (!part) continue;
    const b = stemK(part);
    const ki = b.length >= 4 ? keys.findIndex((k) => stemK(k) === b) : -1;
    if (ki >= 0) { const u = el("span", "pv-k-w", part); u.style.setProperty("--kc", KC[ki % 3]); s.append(u); } else s.append(part);
  }
  return s;
}
function markRun(text, run, cls = "pv-run") {
  const s = el("span"); const t = String(text || ""), r = String(run || "").trim();
  const at = r.length > 3 ? t.toLowerCase().indexOf(r.toLowerCase()) : -1;
  if (at < 0) { s.textContent = t; return s; }
  s.append(t.slice(0, at), el("span", cls, t.slice(at, at + r.length)), t.slice(at + r.length));
  return s;
}
const stag = (node, i) => { node.classList.add("pv-ph-i"); node.style.setProperty("--i", String(i)); return node; };
const PH_TITLE = ["your question, held", "where it\u2019s looking", "what it kept, in each page\u2019s own type", "each kept sentence, cut into who | does | what", "the same things merge; the verbs become links", "the path the answer takes", "each sentence becomes a claim", "claim against source \u2014 then the swap", "every claim against every source"];

function phState(en, ctx) {
  const ph = ctx.ph || (ctx.ph = { keys: [...new Set(askWords(ctx.question))].sort((a, b) => b.length - a.length).slice(0, 3), engines: new Map(), pages: new Map(), shown: -1, frame: null });
  if (en.kind === "st") {
    const st = en.st || {};
    if (st.phase === "searching" || st.phase === "found" || st.phase === "failed") { const k = st.scope || "web"; const e = ph.engines.get(k) || { name: k === "web" ? "The web" : String(k).replace(/^./, (c) => c.toUpperCase()) }; e.state = st.phase; if (st.n != null) e.n = Number(st.n); if (st.why) e.why = st.why; ph.engines.set(k, e); }
    if (st.url && (st.phase === "reading" || st.phase === "read" || st.phase === "unread" || st.phase === "snippet")) { const p = ph.pages.get(st.url) || { url: st.url }; Object.assign(p, { site: st.site || p.site || domainOfUrl(st.url), title: st.title || p.title || "", state: st.phase, chars: st.chars ?? p.chars, kept: st.kept ?? p.kept, text: st.text || p.text || "" }); ph.pages.set(st.url, p); }
  }
  if (en.kind === "draft") ph.draft = { i: en.i, s: en.s };
  if (en.kind === "check" && en.k === 7) ph.evaI = en.i;
  if (en.kind === "check" && en.k === 6) { ph.fzRec = null; ph.fzEva = {}; }
  if (en.kind === "loop") { ph.loop = en; ph.fzRec = null; }
  if (en.kind === "quick") ph.fzRec = null;
  return ph;
}

function paintPhase(P, en, ctx) {
  if (!P.F) return;
  if (P.foot) {
    const d = P.dlog.lastElementChild, rl = [...P.rlog.children].slice(-2);
    const f = el("div", "f");
    if (d) { const r = el("span", "do"); r.append(el("b", "", d.querySelector(".t")?.textContent || ""), " " + (d.querySelector(".n")?.textContent || "")); f.append(r); }
    for (const x of rl) f.append(el("span", "eot", x.textContent));
    P.foot.replaceChildren(f);
  }
  const ph = phState(en, ctx);
  const L = ctx.level;
  if (L == null || L < 0 || L > 8) return;
  const body = (FRAMES[L] || (() => null))(ctx, ph);
  if (!body) return;
  const instant = P.rp.classList.contains("pv-instant");
  if (ph.shown !== L || !ph.frame || !ph.frame.isConnected) {
    const old = ph.frame;
    const f = el("div", "pv-ph pv-ph-" + HELIX[L]);
    const head = el("div", "pv-ph-k"); const g = el("span", "g", G[HELIX[L]]); g.style.color = C[HELIX[L]];
    head.append(g, el("b", "", `${L + 1} \u00b7 ${HELIX[L]}`), el("span", "", PH_TITLE[L]));
    if (L >= 1 && ph.keys.length) { const q = el("span", "q"); q.append(keyed(clip(ctx.question, 70), ph.keys)); head.append(q); }
    f.append(head, body);
    if (old && !instant) { old.classList.add("leave"); const k = parseFloat(getComputedStyle(P.rp).getPropertyValue("--pv-k")) || 1; setTimeout(() => old.remove(), 200); } else if (old) old.remove();
    if (!instant) { f.classList.add("enter"); const k = parseFloat(getComputedStyle(P.rp).getPropertyValue("--pv-k")) || 1; setTimeout(() => f.classList.remove("enter"), 900 / k); }
    P.F.append(f);
    ph.frame = f; ph.shown = L;
  } else {
    ph.frame.replaceChild(body, ph.frame.lastChild);
  }
}

const FRAMES = [
  // 1 · NUL — type only
  (ctx, ph) => {
    const b = el("div", "pv-ph-b ph-nul");
    b.append(stag(keyed(ctx.question || "(the ask)", ph.keys, "bigq"), 0));
    if (ph.keys.length) { const r = el("div", "chips"); for (const [i, k] of ph.keys.entries()) { const c = el("span", "chip", k); c.style.setProperty("--kc", KC[i]); r.append(c); } b.append(stag(r, 1)); }
    return b;
  },
  // 2 · SIG — a ruled list
  (ctx, ph) => {
    const b = el("div", "pv-ph-b ph-sig");
    let i = 0;
    for (const e of ph.engines.values()) {
      const r = el("div", "row eng" + (e.state === "failed" ? " off" : ""));
      r.append(el("span", "ic", "\u25cb"), el("b", "", e.name), el("span", "st", e.state === "searching" ? "searching\u2026" : e.state === "failed" ? (e.why ? clip(e.why, 28) : "failed") : plural(e.n || 0, "result")));
      b.append(stag(r, i++));
    }
    for (const p of [...ph.pages.values()].slice(-6)) {
      const r = el("div", "row" + (p.state === "unread" ? " off" : ""));
      const t = el("span", "t"); t.append(el("b", "", clip(p.title || p.site, 54)), el("span", "d", p.site || ""));
      const dots = el("span", "dots"); const hay = bare(p.title || "") + " " + String(p.title || "").toLowerCase();
      ph.keys.forEach((k, ki) => { const d = el("i"); if (hay.includes(stemK(k))) d.style.background = KC[ki]; else d.classList.add("hollow"); dots.append(d); });
      r.append(fav(domainOfUrl(p.url), p.site), t, dots, el("span", "st", p.state === "reading" ? "reading\u2026" : p.state === "unread" ? "could not read" : p.state === "snippet" ? "snippet" : p.kept ? `kept ${Math.round((p.kept / Math.max(1, p.chars)) * 100)}%` : "read"));
      b.append(stag(r, i++));
    }
    if (!b.childElementCount) b.append(el("div", "none", "asking the sources\u2026"));
    return b;
  },
  // 3 · INS — paper. While a page is being READ its own sentences scroll past (the ones that carry your question's words
  // lit), so the wait before the first kept passage is the reading itself, not a blank.
  (ctx, ph) => {
    const b = el("div", "pv-ph-b ph-ins");
    const mats = (ctx.material || []).slice(-3);
    const readPages = [...ph.pages.values()].filter((p) => p.text);
    const latest = readPages[readPages.length - 1];
    if (latest && (!mats.length || ph.scanNewer === latest.url)) {
      const seen = (ph.scanned ||= new Set());
      const fresh = !seen.has(latest.url); seen.add(latest.url);
      const sents = String(latest.text).split(/(?<=[.!?])\s+(?=["\u201c(\p{Lu}\d])/u).filter((s) => s.length > 12).slice(0, 9);
      const wrap = el("div", "scan" + (fresh ? " fresh" : ""));
      const head = el("div", "sh"); head.append(fav(domainOfUrl(latest.url), latest.site), el("b", "", latest.site || domainOfUrl(latest.url)), el("span", "", `${latest.chars ? latest.chars.toLocaleString("en") + " characters" : "page"}${latest.kept ? ` \u00b7 ${plural(Math.max(1, Math.round(latest.kept / 160)), "passage")} worth keeping` : ""}`));
      wrap.append(head);
      let hits = 0;
      sents.forEach((s, i) => { const hit = ph.keys.some((k) => bare(s).includes(stemK(k))); if (hit) hits++; const ln = el("div", "ln" + (hit ? " hit" : " skim")); ln.style.setProperty("--i", String(i)); ln.append(keyed(clip(s, hit ? 180 : 52), ph.keys)); wrap.append(ln); });
      wrap.append(el("div", "sf", `${plural(hits, "sentence")} of ${sents.length} carry what you asked about`));
      b.append(wrap);
      return b;
    }
    if (!mats.length) { const p = [...ph.pages.values()].pop(); b.append(el("div", "none", p ? `fetching ${p.site}\u2026` : "reading\u2026")); return b; }
    mats.forEach((m, i) => {
      const d = domainOfUrl(m.source); const ty = typeOf(d);
      const card = el("div", "sheet"); Object.assign(card.style, { fontFamily: ty.body });
      const t = String(m.ref || "").split(" \u2014 "); if (t[1]) { const h = el("div", "h", clip(t.slice(1).join(" \u2014 "), 70)); h.style.fontFamily = ty.title; card.append(h); }
      const mk = el("mark"); mk.append(keyed(clip(m.text, 300), ph.keys)); const p = el("div", "p"); p.append(mk); card.append(p, el("div", "s", d || t[0]));
      b.append(stag(card, i));
    });
    return b;
  },
  // 4 · SEG — brackets
  (ctx) => {
    const b = el("div", "pv-ph-b ph-seg");
    const rows = ctx.g?.G?.rows || [];
    const dropped = new Set();
    const LAB = { s: ["SUBJ", "s"], v: ["VERB", "v"], o: ["OBJ", "o"] };
    const list = rows.length ? rows.slice(0, 3) : (ctx.material || []).slice(0, 3).map((m) => { const s = salientSentences(m.text, ctx.question, 1)[0] || ""; const t = tripleOf(s); return { site: domainOfUrl(m.source), domain: domainOfUrl(m.source), groups: [["s", t.e1], ["v", t.rel], ["o", t.e2]] }; });
    list.forEach((r, ri) => {
      const line = el("div", "line");
      const groups = r.groups || (() => { const g = []; r.toks.forEach((tk, i) => { const role = r.roles[i]; const tag = r.tags[i]; if (tag === "punct") return; if (tag === "det" || tag === "prep" || tag === "conj" || (role !== "s" && role !== "v" && role !== "o" && FUNC.has(bare(tk)))) { dropped.add(bare(tk)); if (role !== "s" && role !== "o") return; } const key = LAB[role] ? role : (/\d/.test(tk) ? "w" : "x"); const last = g[g.length - 1]; if (last && last[0] === key) last[1] += " " + tk; else g.push([key, tk]); }); return g; })();
      const src = el("span", "sr"); src.append(fav(r.domain, r.site)); line.append(src);
      for (const [role, txt] of groups) {
        if (!String(txt || "").trim()) continue;
        const c = el("span", "chunk c-" + role); c.append(el("span", "w", clip(txt, 46)), el("span", "l", LAB[role]?.[0] || (role === "w" ? "WHEN" : "\u2014")));
        line.append(c);
      }
      b.append(stag(line, ri));
    });
    if (dropped.size) b.append(el("div", "drop", "dropped: " + [...dropped].slice(0, 10).join(" \u00b7 ")));
    if (!list.length) b.append(el("div", "none", "no sentences to cut"));
    return b;
  },
  // 5 · CON — a graph
  (ctx) => graphFrame(ctx, false),
  // 6 · SYN — the PATH the answer takes: a numbered outline through the web, not the web itself
  (ctx, ph) => synFrame(ctx, ph),
  // 7 · DEF — a ledger
  (ctx) => {
    const b = el("div", "pv-ph-b ph-def");
    const sents = (ctx.checkSents || []).slice(0, 5);
    const g = el("div", "led");
    g.append(el("span", "hd", "#"), el("span", "hd", "CLAIM"), el("span", "hd", "COMMITS TO"));
    sents.forEach((s, i) => {
      const commits = [...new Set([...figuresIn(s).map((f) => f.raw), ...namesIn(s)])].slice(0, 4);
      const ch = el("span", "cm"); if (commits.length) for (const c of commits) ch.append(el("i", "", clip(c, 22))); else ch.append(el("em", "", "a judgement \u00b7 no figure or name"));
      for (const n of [el("span", "n", "s" + (i + 1)), el("span", "s", clip(s, 140)), ch]) g.append(stag(n, i));
    });
    b.append(g);
    return b;
  },
  // 8 · EVA — a diff, then the swap
  (ctx, ph) => {
    const b = el("div", "pv-ph-b ph-eva");
    const i = ph.evaI ?? 0; const s = (ctx.checkSents || [])[i]; if (!s) return b;
    const c = checkOf(ctx, i);
    const src = c.meaning?.sourceSentence && c.lexical !== "ok" ? c.meaning.sourceSentence : (c.win || "");
    const pair = el("div", "pair");
    const a = el("div", "sd"); a.append(el("span", "k", `s${i + 1} \u00b7 claim`), markRun(s, c.run));
    const z = el("div", "sd sr"); z.append(el("span", "k", c.ref ? String(c.ref).split(" \u2014 ")[0] : "no source"), src ? markRun(clip(src, 260), c.run) : el("em", "", "nothing it read says this"));
    pair.append(stag(a, 0), stag(z, 1));
    const fz = (ph.fzEva[i] ||= (() => { try { return falsifyAnswer([s], ctx.material || []).claims[0]; } catch { return null; } })());
    const ticks = el("div", "ticks");
    const tick = (ok, t) => { const x = el("span", ok ? "ok" : "no"); x.append(el("b", "", ok ? "\u2713" : "\u2717"), " " + t); ticks.append(x); };
    tick(c.runN >= 4, c.runN ? `shared run \u00b7 ${plural(c.runN, "word")}` : "no shared run");
    if (fz) { for (const f of fz.figures.slice(0, 2)) tick(fz.witnesses.some((w) => w.verdict === "states" && w.sentence.includes(f)), `${f} in the sentence`); tick(!fz.contradictions, fz.contradictions ? "a source contradicts it" : "no source contradicts it"); tick(fz.chains >= 1, fz.chains >= 2 ? `${fz.chains} independent sources` : fz.chains ? "one source" : "no source states it"); }
    b.append(pair, stag(ticks, 2));
    if (fz && fz.swap.armed) {
      const sw = el("div", "swap"); sw.append(el("span", "k", "swap \u00b7 would a wrong version pass?"));
      const line = el("span", "l"); const at = s.indexOf(fz.swap.from);
      if (at >= 0) line.append(s.slice(0, at), el("s", "", fz.swap.from), " ", el("b", "", fz.swap.to), s.slice(at + fz.swap.from.length)); else line.textContent = `\u201c${fz.swap.to}\u201d for \u201c${fz.swap.from}\u201d`;
      sw.append(line, el("span", fz.swap.discriminates ? "v ok" : "v no", fz.swap.discriminates ? "No longer matches. The source tells the two apart." : "Still matches. The source does not tell them apart."));
      b.append(stag(sw, 3));
    }
    return b;
  },
  // 9 · REC — the matrix, sorted
  (ctx, ph) => {
    const b = el("div", "pv-ph-b ph-rec");
    const sents = ctx.checkSents || []; if (!sents.length) return b;
    const fz = ph.fzRec || (ph.fzRec = (() => { try { return falsifyAnswer(sents, ctx.material || []); } catch { return null; } })());
    if (!fz) return b;
    const srcs = fz.sources.slice(0, 5);
    const t = el("div", "mx"); t.style.gridTemplateColumns = `minmax(0, 1fr) repeat(${srcs.length}, 28px) 92px`;
    t.append(el("span")); for (const s of srcs) { const h = el("span", "c"); h.append(fav(s.domain, String(s.ref || s.key).split(" \u2014 ")[0])); t.append(h); } t.append(el("span"));
    const GROUPS = [["stands", ["corroborated", "held"], "ok"], ["weak or contested", ["weak", "contested"], "warn"], ["no source", ["unsupported"], "bad"]];
    let n = 0;
    for (const [label, vs, tone] of GROUPS) {
      const cs = fz.claims.filter((c) => vs.includes(c.verdict)); if (!cs.length) continue;
      const h = el("span", "grp " + tone, label); h.style.gridColumn = "1 / -1"; t.append(stag(h, n++));
      for (const c of cs) {
        t.append(stag(el("span", "q", `s${c.i + 1} ${clip(c.s, 64)}`), n));
        for (const s of srcs) { const w = c.witnesses.find((x) => x.src === s.key) || { verdict: "silent" }; t.append(stag(el("span", "c v-" + w.verdict, XC[w.verdict] || "\u00b7"), n)); }
        t.append(stag(el("span", "v " + (XV[c.verdict]?.[1] || ""), XV[c.verdict]?.[0] || c.verdict), n)); n++;
      }
    }
    b.append(t);
    if (ph.loop) b.append(el("div", "note", `\u25c9 lap ${ph.loop.lap}: going back for ${plural((ph.loop.failing || []).length, "sentence")}`));
    return b;
  },
];

/** SYN: from the web CON built, the bonds the answer will use, strongest first, as numbered steps (subject, verb, object).
 *  The step the sentence being written touches lights up; the rest recede. Beneath it, the sentence as it is written. */
function synFrame(ctx, ph) {
  const b = el("div", "pv-ph-b ph-syn2");
  const G2 = ctx.g?.G, draft = ph.draft;
  const nodeOf = new Map((G2?.nodes || []).map((n) => [n.id, n]));
  const words = draft ? new Set(String(draft.s).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []) : null;
  const lit = (n) => !!words && n.keys.some((k) => words.has(k));
  const bonds = (G2?.edges || []).map((e) => ({ e, a: nodeOf.get(e.from), z: nodeOf.get(e.to) })).filter((x) => x.a && x.z)
    .sort((p, q) => (q.a.rows.length + q.z.rows.length) - (p.a.rows.length + p.z.rows.length)).slice(0, 4);
  const out = el("div", "outline");
  out.append(el("div", "oh", bonds.length ? (draft ? "the steps this sentence follows" : "the steps the answer will follow") : "nothing linked to follow"));
  const pill = (n) => { const p = el("span", "pl" + (lit(n) ? " on" : ""), clip(n.label, 34)); if (n.rows.length > 1) p.append(el("i", "", String(n.rows.length))); return p; };
  bonds.forEach((r, i) => { const on = lit(r.a) && lit(r.z); const line = el("div", "step" + (on ? " on" : words ? " off" : "")); line.append(el("span", "no", String(i + 1)), pill(r.a), el("span", "vb", clip(r.e.verb || "\u2192", 16)), pill(r.z)); out.append(stag(line, i)); });
  b.append(out, writingEl(draft));
  return b;
}

function graphFrame(ctx, dark, draft = null) {
  const b = el("div", "pv-ph-b ph-gr" + (dark ? " ph-syn" : ""));
  const G2 = ctx.g?.G;
  if (!G2 || !G2.nodes.length) { b.append(el("div", "none", dark ? "writing the answer\u2026" : "no links between the sources")); if (dark && draft) b.append(writingEl(draft)); return b; }
  // Two columns: what the bonds start from, and what they reach. A node is placed by the edges it takes part in (role is
  // only the tie-breaker), so a graph whose subjects were all merged into objects never leaves a column empty.
  const from = new Set(G2.edges.map((e) => e.from)), to = new Set(G2.edges.map((e) => e.to));
  let left = G2.nodes.filter((n) => (from.has(n.id) && !to.has(n.id)) || (n.role === "s" && !to.has(n.id)));
  let right = G2.nodes.filter((n) => !left.includes(n));
  if (!left.length && right.length > 1) { left = right.slice(0, Math.ceil(right.length / 2)); right = right.slice(left.length); }
  left = left.slice(0, 4); right = right.slice(0, 4);
  const ROW = 58, H = Math.max(left.length, right.length) * ROW + 6;
  const stage = el("div", "st"); stage.style.height = H + "px";
  const NS = "http://www.w3.org/2000/svg"; const svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", `0 0 100 ${H}`); svg.setAttribute("preserveAspectRatio", "none");
  const pos = new Map(); left.forEach((n, i) => pos.set(n.id, { x: 0, y: i * ROW })); right.forEach((n, i) => pos.set(n.id, { x: 1, y: i * ROW }));
  const words = draft ? new Set(String(draft.s).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []) : null;
  const lit = (n) => !!words && n.keys.some((k) => words.has(k));
  stage.append(svg);
  for (const e of G2.edges) {
    const a = pos.get(e.from), z = pos.get(e.to); if (!a || !z) continue;
    const y1 = a.y + 20, y2 = z.y + 20;
    const p = document.createElementNS(NS, "path");
    // across the columns a curve; inside one column a bracket on that column's inner edge
    p.setAttribute("d", a.x !== z.x ? `M${a.x ? 62 : 38},${y1} C50,${y1} 50,${y2} ${z.x ? 62 : 38},${y2}` : a.x ? `M62,${y1} C56,${y1} 56,${y2} 62,${y2}` : `M38,${y1} C44,${y1} 44,${y2} 38,${y2}`);
    const on = dark && lit(G2.nodes.find((n) => n.id === e.from)) && lit(G2.nodes.find((n) => n.id === e.to));
    p.setAttribute("class", "e" + (on ? " on" : "")); svg.append(p);
    if (e.verb && !dark) { const v = el("span", "verb", clip(e.verb, 18)); v.style.top = ((y1 + y2) / 2 - 11) + "px"; stage.append(v); }
  }
  let i = 0;
  for (const n of [...left, ...right]) {
    const p = pos.get(n.id);
    const box = el("div", "node" + (n.rows.length > 1 ? " merged" : "") + (p.x ? " r" : "") + (dark ? (lit(n) ? " lit" : " dim") : ""));
    box.style.top = p.y + "px";
    box.append(el("span", "t", clip(n.label, 40)));
    if (n.rows.length > 1 && !dark) box.append(el("span", "m", `merged \u00b7 ${plural(n.rows.length, "source")}`));
    stage.append(stag(box, i++));
  }
  b.append(stage);
  if (!dark) { const merged = G2.nodes.filter((n) => n.rows.length > 1).length; b.append(el("div", "con-cap", `${plural(G2.nodes.length, "thing")} \u00b7 ${plural(G2.edges.length, "bond")}${merged ? ` \u00b7 ${merged} merged across sources` : ""}`)); }
  if (dark) b.append(writingEl(draft));
  return b;
}
function writingEl(draft) {
  const w = el("div", "wr");
  w.append(el("span", "k", draft ? `writing \u00b7 sentence ${draft.i + 1}` : "writing from this graph"));
  const s = el("span", "s", draft ? clip(draft.s, 220) : "the answer streams in above; each finished sentence appears here with the parts of the graph it uses"); if (!draft) s.style.color = "#a9a9b6"; s.append(el("i", "caret")); w.append(s);
  return w;
}

/** Levels SEG, CON, SYN over related sentences from different sources: one set of word nodes that moves, never redrawn. */
function tokenStage(P, en, ctx, { stage, eot, view, level }) {
  if (!Array.isArray(en.ps) || !en.ps.length) return;
  const k = en.k, sub = en.sub || 0;
  if (!ctx.g || ctx.g.key !== en.key || !ctx.g.stageEl.isConnected) {
    const G2 = deriveGraph(en.ps, ctx.question);
    const p = view(`related sentences from ${plural(G2.rows.length, "source")}`);
    const fit = el("div", "pv-fit"); const stageEl = el("div", "pv-gstage");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"); svg.setAttribute("class", "pv-gedges");
    const cap = el("div", "pv-gcap");
    stageEl.append(svg); fit.append(stageEl); p.append(fit, cap);
    const toks = [], labs = [];
    G2.rows.forEach((r, ri) => {
      const ty = typeOf(r.domain);
      const lab = el("div", "pv-rowlab"); lab.append(fav(r.domain, r.site), el("span", "", r.site), el("span", "lang", r.lang)); stageEl.append(lab); labs.push(lab);
      r.toks.forEach((t, i) => { const s = el("span", "pv-tok pv-t-" + r.tags[i]); s.dataset.role = r.roles[i]; s.append(el("span", "w", t), el("span", "l", r.tags[i])); s.style.fontFamily = ty.body; stageEl.append(s); toks.push({ el: s, ri, i, role: r.roles[i], tag: r.tags[i] }); });
    });
    const nodeEls = new Map();
    for (const n of G2.nodes) { const b = el("div", "pv-node" + (n.rows.length > 1 ? " merged" : "")); b.append(el("span", "id", n.id)); stageEl.append(b); nodeEls.set(n.id, b); }
    ctx.g = { key: en.key, G: G2, fit, stageEl, svg, cap, toks, labs, nodeEls };
  }
  const g = ctx.g, { G: G2, fit, stageEl, svg, cap, toks, labs, nodeEls } = g;
  const W = Math.max((fit.clientWidth || 420) < 440 ? 520 : 280, fit.clientWidth || 420);   // a narrow column keeps the layout it was drawn for and pans, rather than overlapping
  const width = (t) => t.el.offsetWidth || (t.el.textContent.length * 7.4);
  let order = 0;
  const nT = Math.max(1, toks.length);
  const put = (node, x, y, extra = {}) => { if (node.classList.contains("pv-tok")) node.style.transitionDelay = `calc(${((order++ / nT) * 0.45).toFixed(3)}s / var(--pv-k, 1))`; node.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; for (const [kk, vv] of Object.entries(extra)) node.style[kk] = vv; };
  const fitTo = (H) => { stageEl.style.height = H + "px"; stageEl.style.width = W + "px"; const avail = Math.max(120, (fit.clientHeight || 260) - 4); const s = Math.min(1, avail / H); stageEl.style.transform = `scale(${s.toFixed(3)})`; };
  for (const c of ["tags", "roles", "graph", "syn"]) stageEl.classList.remove(c);
  svg.replaceChildren();
  level(k);
  if (k === 3) {
    if (sub >= 1) stageEl.classList.add("tags");
    if (sub <= 1) {
      let y = 4;
      G2.rows.forEach((r, ri) => { put(labs[ri], 0, y, { opacity: "1" }); labs[ri].classList.toggle("showlang", sub >= 1); y += 22; let x = 0; for (const t of toks.filter((q) => q.ri === ri)) { const w = width(t); if (x + w > W && x > 0) { x = 0; y += sub ? 36 : 24; } put(t.el, x, y, { opacity: "1" }); x += w + 6; } y += (sub ? 36 : 24) + 12; });
      nodeEls.forEach((b) => { b.style.opacity = "0"; });
      fitTo(y);
      if (sub === 0) { stage("SEG", `Taking ${plural(G2.rows.length, "related sentence")} from different sources`); cap.textContent = "one sentence per source \u2014 the one that says the most about what you asked"; G2.rows.forEach((r) => eot("SEG", `${sidOf(r.url)} \u2192 sentence \u00b7 \u201c${clip(r.sentence, 26)}\u201d`)); }
      else { stage("SEG", "Splitting them into words, and naming each word"); cap.textContent = "language read off the function words; det, aux and prep come from closed lists, names and figures from their shape"; eot("SEG", `${toks.length} words \u00b7 ${[...new Set(toks.map((t) => t.tag))].filter((x) => x !== "punct").join(" ")}`, "var(--ag)"); }
    } else {
      stageEl.classList.add("roles");
      let y = 4;
      G2.rows.forEach((r, ri) => {
        put(labs[ri], 0, y, { opacity: "1" }); y += 22; let x = 0;
        for (const role of ["s", "v", "o"]) { for (const t of toks.filter((q) => q.ri === ri && q.role === role)) { const w = width(t); if (x + w > W && x > 0) { x = 0; y += 30; } put(t.el, x, y, { opacity: "1" }); x += w + 5; } x += 18; }
        for (const t of toks.filter((q) => q.ri === ri && (q.role === "f" || q.role === "x"))) put(t.el, 8 + (t.i % 9) * 24, y + 14, { opacity: "0" });
        y += 46;
      });
      fitTo(y);
      stage("SEG", "Finding who does what to what");
      cap.textContent = "the small words drop away; each sentence splits into subject | verb | object";
      eot("SEG", "sentences \u2192 subject | verb | object", "var(--ag)");
    }
    return;
  }
  stageEl.classList.add("graph"); if (k === 5) stageEl.classList.add("syn");
  const colW = Math.floor(W * 0.36), gapY = 20;
  const pos = new Map(); let yL = 8, yR = 8;
  const mine = (n) => toks.filter((q) => ((q.role === "s" && G2.rows[q.ri].nS === n) || (q.role === "o" && G2.rows[q.ri].nO === n)));
  for (const n of G2.nodes) { let x = 0, lines = 1; for (const t of mine(n).filter((q) => q.ri === n.rows[0])) { const w = width(t); if (x + w > colW - 18 && x > 0) { x = 0; lines++; } x += w + 5; } const h = lines * 24 + 16; const left = n.role === "s"; pos.set(n.id, { x: left ? 0 : W - colW, y: left ? yL : yR, w: colW, h }); if (left) yL += h + gapY; else yR += h + gapY; }
  for (const n of G2.nodes) { const p = pos.get(n.id); put(nodeEls.get(n.id), p.x, p.y, { width: p.w + "px", height: p.h + "px", opacity: "1" }); }
  for (const n of G2.nodes) { const p = pos.get(n.id); let x = p.x + 9, y = p.y + 8; for (const t of mine(n)) { if (t.ri !== n.rows[0]) { put(t.el, p.x + 10, p.y + 8, { opacity: "0" }); continue; } const w = width(t); if (x + w > p.x + p.w - 9 && x > p.x + 9) { x = p.x + 9; y += 24; } put(t.el, x, y, { opacity: "1" }); x += w + 5; } }
  for (const t of toks) if (t.role === "f" || t.role === "x") put(t.el, W / 2, 0, { opacity: "0" });
  labs.forEach((l) => put(l, 0, 0, { opacity: "0" }));
  const H = Math.max(yL, yR) + 12;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  G2.edges.forEach((e) => {
    const a = pos.get(e.from), b2 = pos.get(e.to); const vt = toks.filter((q) => q.ri === e.row && q.role === "v");
    if (!a || !b2) { vt.forEach((q) => put(q.el, W / 2, H - 20, { opacity: "0" })); return; }
    const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b2.x, y2 = b2.y + b2.h / 2, mx = (x1 + x2) / 2;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`); line.setAttribute("class", "pv-edge-l"); svg.append(line);
    let x = mx - Math.min(vt.reduce((s, q) => s + width(q) + 5, 0), x2 - x1 - 10) / 2, y = (y1 + y2) / 2 - 24; const x0 = x;
    for (const q of vt) { const w = width(q); if (x + w > x2 - 5 && x > x0) { x = x0; y += 18; } put(q.el, x, y, { opacity: "1" }); x += w + 5; }
  });
  for (const t of toks) if (t.role === "v" && !G2.edges.some((e) => e.row === t.ri)) put(t.el, W / 2, H - 20, { opacity: "0" });
  fitTo(H);
  const merged = G2.nodes.filter((n) => n.rows.length > 1);
  if (k === 4) { stage("CON", "Linking the things they name through their verbs"); cap.textContent = "subjects on the left, objects on the right; each verb becomes the link"; for (const n of G2.nodes) eot("INS", `${n.id} : entity \u00b7 \u201c${clip(n.label, 26)}\u201d`, TOKC[0]); for (const e of G2.edges) eot("CON", `${e.from} -> ${e.to} \u00b7 ${clip(e.verb, 16)}`, TOKC[1]); }
  if (k === 5) { stage("SYN", "Composing one graph from every source"); cap.textContent = merged.length ? `${plural(merged.length, "thing")} named by more than one source \u2014 one node, and the sources join up` : `${plural(G2.rows.length, "source")} composed into ${plural(G2.nodes.length, "node")} and ${plural(G2.edges.length, "link")}`; eot("SYN", `graph \u2190 ${G2.nodes.map((n) => n.id).join(", ")}${merged.length ? " \u00b7 merged " + merged.map((n) => n.id).join(", ") : ""}`, "var(--ag)"); ctx.srcs = Math.max(ctx.srcs, G2.rows.length); }
}

/** One sentence of the answer, checked against what was read: the passage it shares the longest run of words with, and
 *  a window of that passage around the run. Computed once, at record time, against the FULL passages, and stored on the
 *  tape — so the replay shows exactly the verdict the live turn reached. */
const stem = (w) => bare(w).slice(0, 5);
/** A claim as a relation: end1 —label→ end2, each end reduced to the stems of its content words. */
function tripleOf(sentence) {
  const toks = String(sentence).split(/\s+/).filter(Boolean).slice(0, 40);
  const tags = toks.map((t, i) => tagOf(t, i));
  let vi = tags.findIndex((t, i) => i > 0 && (t === "aux" || t === "verb"));
  if (vi < 1) vi = Math.min(2, Math.max(0, toks.length - 1));
  let ve = vi + 1; while (ve < toks.length && (tags[ve] === "verb" || tags[ve] === "aux")) ve++;
  if (tags[vi] === "aux" && ve < toks.length && tags[ve] === "word" && /(ed|en|s)$/.test(bare(toks[ve]))) ve++;
  const keys = (arr) => [...new Set(arr.filter((w) => !FUNC.has(bare(w)) && bare(w).length > 2).map(stem))];
  const e1 = toks.slice(0, vi), rel = toks.slice(vi, ve), e2 = toks.slice(ve);
  return { e1: e1.join(" "), rel: rel.join(" "), e2: e2.join(" "), k1: keys(e1), kr: keys(rel), k2: keys(e2) };
}
/** Do two claims say the same thing? Same referents (either end of one names an end of the other) and a relation that
 *  agrees (same verb stem, or both relations about the same referents with no verb in common = "related"). */
function sameMeaning(a, b) {
  const ends = (t) => new Set([...t.k1, ...t.k2]);
  const ea = ends(a), eb = ends(b);
  const refs = [...ea].filter((k) => eb.has(k));
  const rel = a.kr.some((k) => b.kr.includes(k));
  const slot1 = a.k1.some((k) => eb.has(k)), slot2 = a.k2.some((k) => eb.has(k));
  return { refs, rel, slot1, slot2, level: refs.length >= 2 && rel ? "same" : refs.length >= 1 && (rel || refs.length >= 2) ? "related" : refs.length ? "touches" : "none" };
}
function computeCheck(s, material) {
  let e = null; try { e = attribute(s, material || [])[0] || null; } catch {}
  let mat = e && e.ref ? (material || []).find((m) => m.ref === e.ref) : null;
  let run = "", runN = 0, from = 0, to = 0;
  if (e && e.span && e.sourceText) { from = e.span.start; to = e.span.end; run = e.sourceText.slice(from, to); runN = (run.match(/[\p{L}\p{N}]+/gu) || []).length; }
  if (!mat) { const w = new Set(s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []); let best = null, bn = 0; for (const m of material || []) { const n = (String(m.text).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((x) => w.has(x)).length; if (n > bn) { bn = n; best = m; } } mat = best; }
  const full = String(e?.sourceText || mat?.text || "");
  const lo = Math.max(0, (to ? from : 0) - 150), hi = Math.min(full.length, (to || 180) + 150);
  const win = full ? (lo > 0 ? "\u2026 " : "") + full.slice(lo, hi) + (hi < full.length ? " \u2026" : "") : "";
  const verdict = e && e.ref ? (runN && runN < 4 ? "weak" : "ok") : "none";
  const enc = new TextEncoder();
  const bytes = to ? { start: enc.encode(full.slice(0, from)).length, end: enc.encode(full.slice(0, to)).length } : null;
  // MEANING: the answer's claim as a relation, against the source sentence whose relation is nearest to it
  const at = tripleOf(s);
  let best = null;
  for (const cand of salientSentences(full || win, s, 4)) { const t = tripleOf(cand); const m = sameMeaning(at, t); const sc = m.refs.length * 2 + (m.rel ? 3 : 0); if (!best || sc > best.sc) best = { sc, cand, t, m }; }
  const meaning = best ? { claim: at, source: best.t, sourceSentence: best.cand, ...best.m } : { claim: at, source: null, level: "none", refs: [], rel: false };
  const verdict2 = meaning.level === "same" ? "ok" : meaning.level === "related" ? (verdict === "ok" ? "ok" : "weak") : verdict === "ok" && meaning.level === "touches" ? "weak" : verdict === "ok" ? "weak" : "none";
  return { s, ref: e?.ref || mat?.ref || null, source: mat?.source || "", run, runN, win, verdict: verdict2, lexical: verdict, backed: !!(e && e.ref), chars: to ? { start: from, end: to } : null, bytes, meaning };
}
function checkOf(ctx, i) { ctx.checks = ctx.checks || []; return ctx.checks[i] || (ctx.checks[i] = computeCheck((ctx.checkSents || [])[i] || "", ctx.material)); }
const VERDICT = { ok: ["\u2713", "backed"], weak: ["!", "weak"], none: ["\u2731", "no source"] };

/** Levels DEF, EVA, REC: the answer's sentences as claims, each matched word by word against what was read, then the frame. */
function checkStage(P, en, ctx, { stage, eot, view, level }) {
  if (en.k === 6) {
    ctx.checkSents = en.sents || sentencesOf(en.text || "").slice(0, 6); ctx.checks = Array.isArray(en.checks) ? en.checks.slice() : [];
    level(6); stage("DEF", `The answer is ${plural(ctx.checkSents.length, "sentence")} \u2014 each becomes a claim`);
    const p = view("the answer, as claims");
    ctx.checkSents.forEach((s, i) => { const r = el("div", "pv-claim pv-in"); r.style.animationDelay = i * 120 + "ms"; r.append(el("b", "", "s" + (i + 1)), el("span", "", s)); p.append(r); eot("DEF", `s${i + 1} : claim \u00b7 \u201c${clip(s, 30)}\u201d`, TOKC[2]); });
    p.append(el("div", "pv-gcap", "next: each claim is read as a relation \u2014 this thing, doing that, to that \u2014 and held against the relations the sources make"));
    return;
  }
  if (en.k === 7) {
    level(7);
    const i = en.i, c = checkOf(ctx, i), m = c.meaning || { claim: tripleOf(c.s), source: null, level: "none" };
    stage("EVA", `Does s${i + 1} mean what a source says?`);
    const p = view(`s${i + 1} of ${ctx.checkSents.length}`);
    const wrap = el("div", "pv-mean");
    const row = (label, t, other, src) => {
      const r = el("div", "pv-rel pv-in" + (src ? " src" : ""));
      r.append(el("span", "who", label));
      const cell = (txt, keys, cls) => { const d = el("span", "end " + cls); d.textContent = txt || "\u2014"; if (other && keys.some((k) => [...other.k1, ...other.k2, ...other.kr].includes(k))) d.classList.add("match"); return d; };
      if (!t) { r.append(el("span", "none", "no claim in anything it read is about these things")); return r; }
      r.append(cell(clip(t.e1, 60), t.k1, "e1"), cell(clip(t.rel, 30), t.kr, "rel"), cell(clip(t.e2, 80), t.k2, "e2"));
      return r;
    };
    wrap.append(row("the answer says", m.claim, m.source, false));
    const d = { title: c.ref || "", domain: domainOfUrl(c.source), url: c.source };
    wrap.append(row(c.ref ? siteOf(d) + " says" : "the sources", m.source, m.claim, true));
    const why = el("div", "pv-eva-v " + c.verdict);
    const L = { same: "Same things, same relation \u2014 it means what the source says.", related: "Same things, and the relation agrees in part \u2014 close, not the same claim.", touches: "It names something the source names, but says something else about it.", none: "Nothing it read makes this claim." };
    why.append(el("b", "", VERDICT[c.verdict][0]), " " + L[m.level || "none"]);
    if (c.bytes) why.append(el("span", "at", ` \u00b7 grounded at bytes ${c.bytes.start}\u2013${c.bytes.end}`));
    wrap.append(why);
    if (m.sourceSentence) { const q = el("div", "pv-mean-q"); q.textContent = "\u201c" + clip(m.sourceSentence, 220) + "\u201d"; q.style.fontFamily = typeOf(d.domain).body; wrap.append(q); }
    p.append(wrap);
    eot("EVA", `s${i + 1} \u2248 ${m.level === "none" ? "\u2205" : clip(siteOf(d), 16)} \u00b7 ${m.level}${m.refs && m.refs.length ? " \u00b7 " + m.refs.slice(0, 3).join(", ") : ""}`, c.verdict === "ok" ? "var(--ok)" : "var(--warn)");
    return;
  }
  if (en.k === 8) {
    level(8);
    const cs = (ctx.checkSents || []).map((_, i) => checkOf(ctx, i));
    const ok = cs.filter((c) => c.verdict === "ok").length, weak = cs.filter((c) => c.verdict === "weak").length, none = cs.filter((c) => c.verdict === "none").length;
    stage("REC", none ? `${none} of ${plural(cs.length, "sentence")} ${none === 1 ? "has" : "have"} no source` : "Every sentence stands on what it read");
    const p = view("what the answer stands on");
    cs.forEach((c, i) => { const r = el("div", "pv-claim pv-in " + c.verdict); r.style.animationDelay = i * 120 + "ms"; r.append(el("b", "", VERDICT[c.verdict][0] + " s" + (i + 1)), el("span", "", c.s), el("em", "", c.verdict === "none" ? "no source" : `${siteOf({ title: c.ref })} \u00b7 run ${c.runN}`)); p.append(r); });
    p.append(el("div", "pv-gcap", `${ok} backed \u00b7 ${weak} weak \u00b7 ${none} with no source \u2014 the answer is drawn with these marks`));
    eot("REC", `frame \u2190 ${cs.map((c, i) => (c.verdict === "none" ? "" : "s" + (i + 1))).filter(Boolean).join(", ") || "\u2205"}${none ? " \u00b7 " + none + " unsupported" : ""}`, none ? "var(--warn)" : "var(--ok)");
  }
}

/** Sorted copy of a tape. */
const sorted = (tape) => [...tape].sort((a, b) => a.at - b.at || a.seq - b.seq);

/** FULL SCREEN: a view of the processing is either a compact status or the whole screen, never a squeezed middle. A narrow column (a phone, the
 *  side panel) gets the replay as a full-screen sheet; the "full" turn view does the same to the live reading. The sheet sits over the chat
 *  column only, above the composer (its Stop button stays reachable). */
const fullWanted = (slot) => { try { return (slot && slot.parentElement ? slot.parentElement.clientWidth : innerWidth) < 560 || innerWidth < 700; } catch { return false; } };
export function fitFullView() {
  try {
    const main = document.querySelector("main.main"), comp = document.querySelector(".composer-wrap"), top = document.querySelector(".topbar");
    const r = main ? main.getBoundingClientRect() : { left: 0, right: innerWidth };
    const st = document.documentElement.style;
    st.setProperty("--pv-left", Math.round(r.left) + "px"); st.setProperty("--pv-right", Math.round(innerWidth - r.right) + "px");
    st.setProperty("--pv-top", Math.round(top ? top.getBoundingClientRect().bottom : 0) + "px");
    st.setProperty("--pv-bottom", Math.round(comp ? innerHeight - comp.getBoundingClientRect().top : 0) + "px");
  } catch {}
}
if (typeof window !== "undefined" && !globalThis.__pvFitWired) { globalThis.__pvFitWired = true; addEventListener("resize", fitFullView); addEventListener("fold:tv", fitFullView); }

/** THE LIVE RECORDER: the answer streams above (markdown as it arrives); below, the panels follow the real clock and record
 *  the tape. The checks (DEF, EVA, REC) run after the answer is written — in the real order. */
export function mountLive(body, { question = "", mdHtml = null } = {}) {
  const P = buildPanels();
  const ans = el("div", "pv-liveans"); const ansMd = el("div", "ganswer md"); ans.append(ansMd); ans.hidden = true;
  body.prepend(P.rp); body.prepend(ans);
  fitFullView();
  body.classList.add("pv-live-on", "pv-quiet");   // pv-quiet outlasts the animation: the step log stays out of sight for the whole turn (only the Working line shows)
  const ctx = newCtx(question);
  const tape = []; const t0 = performance.now();
  let seq = 0, closed = false, readEnd = 0, srcs = 0, liveText = "", painted = false, writingAt = 0, checked = false, fullMat = [], drafted = 0, lastDraft = 0, recordOnly = false;
  const pendingLoops = [];
  const now = () => (performance.now() - t0) / 1000;
  const push = (kind, data, at = now()) => {
    const en = { at: +at.toFixed(3), seq: seq++, kind, ...data };
    tape.push(en);
    const wait = en.at - now();
    if (wait <= 0.02) { if (!recordOnly) applyEntry(P, en, ctx); } else setTimeout(() => { if (!closed && !recordOnly) applyEntry(P, en, ctx); }, wait * 1000);
  };
  push("start", {});
  return {
    event(e) { if (!closed && e && e.type === "t") push("ev", { e: { op: e.op, id: e.id, title: e.title, tone: e.tone, note: e.note, text: e.text, ms: e.ms } }); },
    step(st) { if (!closed && st) push("st", { st: slimSt(st) }); },
    loop(lap, failing) { if (!closed) pendingLoops.push({ lap, failing: (failing || []).map((f) => ({ i: f.i, verdict: f.verdict, query: f.query || "" })) }); },
    /** The answer is written: the live animation ends here (it folds away); everything after — the checks, the REC
     *  loop — is still recorded on the tape, for the replay, but not drawn live. */
    writingDone() {
      if (closed || recordOnly) return;
      // the LIVE view keeps the panel up and keeps drawing through the checks; quiet and full fold it away (it is still on the tape either way)
      if (document.documentElement.dataset.tv === "live" || !document.documentElement.dataset.tv) { try { localStorage.getItem("fold-chat:turnView"); } catch {} if ((document.documentElement.dataset.tv || "live") === "live") return; }
      recordOnly = true;
      P.rp.classList.add("pv-folding");
      setTimeout(() => { P.rp.remove(); ans.remove(); body.classList.remove("pv-live-on"); }, 450);
    },
    book(b, found) { if (!closed) push("book", { title: b.title, url: b.url, paras: found.paras, matched: found.matched, names: found.names, chapters: found.chapters }); },
    passages(list) {
      if (closed || !list || !list.length) return;
      fullMat = list.map((p) => ({ ref: p.ref || "", source: p.url || p.source || "", text: String(p.text || "") }));
      let t = Math.max(now(), readEnd);
      const all = list.slice(0, 7);
      all.forEach((ps, j) => { push("quick", { n: j + 1, of: all.length, p: slimP(ps) }, t); t += 0.9; });
      const seen = new Set(), pick = [];
      for (const ps of all) { const dm = domainOfUrl(ps.url || ps.source) + "|" + (ps.ref || ""); if (seen.has(dm)) continue; seen.add(dm); pick.push(slimP(ps)); if (pick.length === 3) break; }
      const key = sidOf(pick.map((p) => p.url).join("|") + question);
      for (const [k, sub, dwell] of [[3, 0, 1.8], [3, 1, 2.0], [3, 2, 2.2], [4, 0, 2.8], [5, 0, 2.2]]) { push("deep", { k, sub, key, ps: pick }, t); t += dwell; }
      srcs = all.length; readEnd = t;
    },
    writing(by = "model") { if (!closed) { writingAt = Math.max(now(), readEnd); push("writing", { srcs, by }, writingAt); readEnd = Math.max(readEnd, writingAt + 0.8); } },
    wrote(full, final = false) {
      if (closed) return;
      liveText = full;
      // every sentence the model has finished becomes a "draft" frame, so the middle shows the writing as it happens
      { const ss = sentencesOf(full); const doneN = final ? ss.length : Math.max(0, ss.length - 1); while (drafted < Math.min(doneN, 6)) { const at = Math.max(now(), readEnd, lastDraft + 0.9); lastDraft = at; push("draft", { i: drafted, s: ss[drafted] }, at); drafted++; readEnd = Math.max(readEnd, at); } }
      if (!painted) { painted = true; requestAnimationFrame(() => { painted = false; if (mdHtml) ansMd.innerHTML = mdHtml(liveText); else ansMd.textContent = liveText; }); }
      if (final && !checked) {
        checked = true;
        const sents = sentencesOf(full).slice(0, 6);
        if (!sents.length) return;
        let t = Math.max(now(), readEnd);
        const checks = sents.map((s) => computeCheck(s, fullMat.length ? fullMat : ctx.material));
        push("check", { k: 6, text: clip(full, 3000), sents, checks }, t); t += 1.8;
        sents.forEach((_, i) => { push("check", { k: 7, i }, t); t += 2.6; });
        push("check", { k: 8 }, t); t += 2.6;
        for (const lp of pendingLoops.splice(0)) { push("loop", lp, t); t += 2.4; }
        readEnd = t;
      }
    },
    settled() { const wait = Math.max(0, readEnd - now()) + 0.2; return new Promise((r) => setTimeout(r, wait * 1000)); },
    finish() { const liveT = now(); push("done", {}, Math.max(liveT, readEnd)); return { tape: sorted(tape), liveT }; },
    close() { if (closed) return; closed = true; body.classList.remove("pv-live-on", "pv-quiet"); P.rp.remove(); ans.remove(); },
  };
}

const TAPE_SPEEDS = [[1, "1\u00d7"], [0.5, "\u00bd\u00d7"], [0.25, "\u00bc\u00d7"], [0.1, "\u2152\u00d7"], [0.05, "\u00b9\u2044\u2082\u2080\u00d7"]];
/** The strip for a turn drawn without the presented view (no sentence grounded): still the way back into the reading. */
export function renderTapeStrip(body, rec, question = "") {
  const box = el("div", "pv pv-research");
  const slot = el("div", "pv-rp-slot"); slot.hidden = true;
  box.append(logButton(rec, question)); setTimeout(() => body.append(box), 0); armed = null;
  return box;
}
/** THE LOG: everything the turn did, as JSON — the steps in order, the sources (with ids), every sentence of the answer with
 *  its verdict, the verbatim run of source text that grounds it, and that run's character and UTF-8 byte offsets in the
 *  passage it was read from. */
export function buildLog(rec, question = "") {
  const tape = Array.isArray(rec?.tape) ? sorted(rec.tape) : [];
  const steps = tape.map((e) => {
    const base = { at: e.at, kind: e.kind };
    if (e.kind === "ev") return { ...base, op: e.e?.op, title: e.e?.title, note: e.e?.note || e.e?.text || undefined, ms: e.e?.ms };
    if (e.kind === "st") return { ...base, ...e.st };
    if (e.kind === "quick") return { ...base, level: "INS", source: sidOf(e.p.url), url: e.p.url, ref: e.p.ref };
    if (e.kind === "deep") return { ...base, level: HELIX[e.k], sub: e.sub || 0 };
    if (e.kind === "check") return { ...base, level: HELIX[e.k], sentence: e.i };
    if (e.kind === "book") return { ...base, title: e.title, paragraphs: e.paras, matched: e.matched };
    return base;
  });
  const srcs = new Map();
  for (const e of tape) if (e.kind === "quick" && e.p?.url) srcs.set(e.p.url, { id: sidOf(e.p.url), url: e.p.url, ref: e.p.ref });
  for (const s of rec?.facing?.sources || []) if (s.url && !srcs.has(s.url)) srcs.set(s.url, { id: sidOf(s.url), url: s.url, ref: s.ref });
  const k6 = tape.find((e) => e.kind === "check" && e.k === 6);
  const claims = (k6?.checks || []).map((c, i) => ({ id: "s" + (i + 1), sentence: c.s, verdict: c.verdict, source: c.source ? { id: sidOf(c.source), url: c.source, ref: c.ref } : null, verbatim: c.run || null, words: c.runN || 0, chars: c.chars || null, bytes: c.bytes || null, offsetsIn: "the passage kept from that page" }));
  const grounding = (rec?.facing?.sources || []).map((s) => ({ tag: s.n, source: s.url ? sidOf(s.url) : null, url: s.url, ref: s.ref, verbatim: s.mark, chars: s.span || null }));
  const response = (rec?.facing?.response || []).map((r) => ({ sentence: r.text, tag: r.tag, grounded: r.grounded, address: r.address }));
  let falsify = null; try { falsify = falsifiersOf(rec); } catch {}
  return { schema: "FoldTurnLog@1", falsify, question, turn: rec?.turn ?? null, model: rec?.model ?? null, levels: HELIX, steps, sources: [...srcs.values()], claims, grounding, response, checks: { coverage: rec?.coverage ? { grounded: rec.coverage.grounded, total: rec.coverage.total } : null, unsupported: rec?.unsupported || null } };
}
function logButton(rec, question) {
  const row = el("div", "pv-logrow");
  const b = el("button", "pv-btn", "copy JSON"); b.type = "button"; b.title = "The full log of this turn: every step, the sources, and the verbatim text (with byte offsets) behind each sentence";
  b.onclick = async () => { try { await navigator.clipboard.writeText(JSON.stringify(buildLog(rec, question), null, 2)); b.textContent = "copied \u2713"; } catch { b.textContent = "copy failed"; } setTimeout(() => { b.textContent = "copy JSON"; }, 1500); };
  row.append(b, el("span", "", "the full log \u00b7 every step, source and grounding run, with byte offsets"));
  return row;
}
/** (kept for older callers) */
function tapeStrip(rec, question, slot) {
  const tape = rec.tape;
  const pages = new Set(tape.filter((e) => e.kind === "st" && e.st?.phase === "reading").map((e) => e.st.url)).size;
  const kept = Math.max(tape.filter((e) => e.kind === "quick").length + (tape.some((e) => e.kind === "deep") ? 1 : 0), 0);
  const strip = el("div", "pv-strip");
  const btn = el("button", "pv-strip-b"); btn.type = "button"; btn.setAttribute("aria-expanded", "false");
  btn.append(el("span", "car", "\u25b8"), el("b", "", "How I got here"), el("span", "sum", [pages ? plural(pages, "page") + " read" : (rec.book ? `all of ${rec.book.title}` : ""), kept ? plural(kept, "passage") + " kept" : "", "related sentences parsed into a graph"].filter(Boolean).join(" \u00b7 ")), el("span", "play", "\u25b6 watch"));
  strip.append(btn);
  let player = null;
  const setOpen = (on) => { btn.setAttribute("aria-expanded", String(on)); btn.querySelector(".car").textContent = on ? "\u25be" : "\u25b8"; strip.classList.toggle("open", on); };
  strip.open = (from = 0, opts = {}) => {
    if (!player) player = mountTapePlayer(slot, tape, { question, onClose: () => setOpen(false) });
    setOpen(true); player.show(from, opts);
  };
  btn.onclick = () => { if (strip.classList.contains("open")) { player?.hide(); setOpen(false); } else strip.open(0, { autoplay: true, foldAtEnd: true }); };
  return strip;
}

/** THE PLAYER: the three panels over a stored tape, with play/pause, frame steps, speeds down to 1/20× and a scrubber. */
function mountTapePlayer(slot, tapeIn, { question = "", onClose = null } = {}) {
  const tape = sorted(tapeIn);
  const END = (tape.length ? tape[tape.length - 1].at : 0) + 0.6;
  const wrap = el("div", "pv-player");
  const P = buildPanels();
  const bar = el("div", "pv-tape-bar");
  const play = el("button", "pv-btn pv-play", "\u25b6"); play.type = "button"; play.setAttribute("aria-label", "Play");
  const back = el("button", "pv-btn pv-step", "\u25c2"); back.type = "button"; back.title = "Previous step"; back.setAttribute("aria-label", "Previous step");
  const fwd = el("button", "pv-btn pv-step", "\u25b8"); fwd.type = "button"; fwd.title = "Next step"; fwd.setAttribute("aria-label", "Next step");
  const clock = el("span", "pv-clock", "0.0s");
  const sp = el("div", "pv-speed"); sp.setAttribute("role", "group"); sp.setAttribute("aria-label", "Replay speed");
  let speed = 1; try { speed = Number(localStorage.getItem("fold-chat:tapeSpeed")) || 1; } catch {}
  const sbs = TAPE_SPEEDS.map(([v, label]) => { const b = el("button", "", label); b.type = "button"; b.onclick = () => { speed = v; try { localStorage.setItem("fold-chat:tapeSpeed", String(v)); } catch {} paintSpeed(); }; return b; });
  sp.append(...sbs);
  // the slower it plays, the more it shows: word labels, full ledger lines, the caption under every move
  const paintSpeed = () => { sbs.forEach((b, i) => { const on = TAPE_SPEEDS[i][0] === speed; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); }); P.rp.style.setProperty("--pv-k", String(speed)); P.rp.dataset.detail = speed <= 0.1 ? "3" : speed <= 0.25 ? "2" : speed <= 0.5 ? "1" : "0"; };
  const x = el("button", "pv-rp-x", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Close");
  bar.append(back, play, fwd, clock, sp, x);
  // the scrubber: a range input, with a glyph tick for every station and passage
  const scrub = el("div", "pv-tscrub");
  const range = el("input"); range.type = "range"; range.min = "0"; range.max = String(END); range.step = "0.01"; range.value = "0"; range.setAttribute("aria-label", "Scrub through the reading");
  const ticks = el("div", "pv-ticks");
  for (const en of tape) {
    const lvl = en.kind === "loop" ? 8 : en.kind === "start" ? 0 : en.kind === "st" && en.st?.phase === "searching" ? 1 : en.kind === "quick" || en.kind === "book" ? 2 : en.kind === "deep" ? en.k : en.kind === "writing" ? 5 : en.kind === "check" ? en.k : -1;
    if (lvl < 0 || (en.kind === "deep" && en.sub) || (en.kind === "quick" && en.n > 1) || (en.kind === "check" && en.k === 7 && en.i > 0)) continue;
    const t = el("button", "pv-tick" + (lvl >= 3 ? " deep" : ""), G[HELIX[lvl]]); t.type = "button";
    t.style.left = (en.at / END) * 100 + "%";
    t.title = `${lvl + 1} \u00b7 ${HELIX[lvl]} \u00b7 ${LEVEL[lvl]}`;
    t.onclick = () => seek(en.at, true);
    ticks.append(t);
  }
  scrub.append(ticks, range);
  wrap.append(P.rp, scrub, bar);
  let ctx = newCtx(question), applied = 0, T = 0, playing = false, raf = 0, last = 0, foldAtEnd = false;
  const rebuild = () => {
    P.rp.classList.add("pv-instant");
    P.dlog.replaceChildren(); P.rlog.replaceChildren(); P.L.replaceChildren(); P.F?.replaceChildren();
    ctx = newCtx(question); applied = 0;
  };
  const applyTo = (t, instant) => {
    if (instant) P.rp.classList.add("pv-instant");
    while (applied < tape.length && tape[applied].at <= t) applyEntry(P, tape[applied++], ctx);
    if (instant) requestAnimationFrame(() => P.rp.classList.remove("pv-instant"));
  };
  const paint = () => { range.value = String(T); clock.textContent = `${keyTimes.filter((t) => t <= T + 0.001).length} / ${keyTimes.length} \u00b7 ${T.toFixed(1)}s`; play.textContent = playing ? "\u275a\u275a" : T >= END ? "\u21bb" : "\u25b6"; play.setAttribute("aria-label", playing ? "Pause" : "Play"); };
  function seek(t, keepPlaying = false) {
    t = Math.max(0, Math.min(END, t));
    if (t < T || applied === 0) { rebuild(); applyTo(t, true); } else applyTo(t, true);
    T = t; if (!keepPlaying) playing = false; paint(); if (playing) run();
  }
  function frame(now) {
    if (!wrap.isConnected || slot.hidden) { raf = 0; playing = false; return; }
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    T = Math.min(END, T + dt * speed);
    // ONLY THE KEYFRAMES: where nothing in the frame changes (the tape only logged a step, or the model was thinking), the
    // clock jumps to just before the next change instead of playing the wait out.
    const nk = keyTimes.find((t) => t > T + 0.001);
    if (nk != null && nk - T > IDLE) T = nk - LEAD;
    applyTo(T, false); paint();
    if (T >= END) { playing = false; raf = 0; paint(); if (foldAtEnd) { foldAtEnd = false; setTimeout(() => { slot.classList.add("pv-folding"); setTimeout(() => { hide(); slot.classList.remove("pv-folding"); onClose && onClose(); }, 450); }, 1400); } return; }
    raf = requestAnimationFrame(frame);
  }
  const run = () => { last = performance.now(); if (!raf) raf = requestAnimationFrame(frame); };
  play.onclick = () => { if (playing) { playing = false; paint(); return; } if (T >= END) seek(0); playing = true; paint(); run(); };
  // A keyframe is an entry that changes what the frame shows: a new level, a source, a passage, a token, a draft, a check, a
  // lap. Ledger-only steps ('ev') and a level's sub-steps ride along with the keyframe they belong to.
  const keyTimes = [...new Set(tape.filter((e) => e.kind !== "ev" && e.kind !== "done" && !(e.kind === "deep" && e.sub)).map((e) => Math.round(e.at * 20) / 20))].sort((a, b) => a - b);
  const IDLE = 0.5, LEAD = 0.05;
  fwd.onclick = () => { const n = keyTimes.find((t) => t > T + 0.001); seek(n != null ? n : END); };
  back.onclick = () => { const p = [...keyTimes].reverse().find((t) => t < T - 0.001); seek(p != null ? p : 0); };
  range.oninput = () => seek(Number(range.value), false);
  function hide() { slot.hidden = true; playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  x.onclick = () => { hide(); onClose && onClose(); };
  wrap.addEventListener("keydown", (ev) => { if (ev.key === " " && ev.target === wrap) { ev.preventDefault(); play.onclick(); } if (ev.key === "ArrowRight") { ev.preventDefault(); fwd.onclick(); } if (ev.key === "ArrowLeft") { ev.preventDefault(); back.onclick(); } });
  wrap.tabIndex = 0;
  slot.replaceChildren(wrap);
  paintSpeed();
  return {
    show(from = 0, { autoplay = false, foldAtEnd: f = false } = {}) { slot.hidden = false; wrap.classList.toggle("pv-full", fullWanted(slot)); fitFullView(); foldAtEnd = f; rebuild(); T = 0; seek(from); if (autoplay) { playing = true; paint(); run(); } },
    hide,
  };
}
