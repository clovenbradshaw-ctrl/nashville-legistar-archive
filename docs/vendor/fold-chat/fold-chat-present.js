// fold-chat-present.js — how an answer is DRAWN, decided by how its turn went. Pure: no DOM, no network.
//
// There is no setting. The turn's own record picks the layout, and the more contested the turn, the more of
// the working shows:
//   one     one source, said the same            → the passage underneath, the checks as one line
//   agree   several sources, nothing conflicts   → the best passage on top, the rest stacked behind it
//   split   the sources give different figures   → grouped by what they say, every check listed
//   mixed   part fact, part invention            → each sentence marked sourced or imagined, checks listed
//            ("…from the perspective of Natasha", a story, a poem with sources)
//   creative  a poem, a story, a letter (kind generate) → set as a manuscript: a literary face, a narrow measure,
//            the sources it drew on as marginal notes; never scored, so no checks — the register itself says so
//   book    an ask about a book on the shelf  → the scenes it rests on, in story order, in the book's own type
// A turn with no sources is not drawn here: the typed gap already is the turn.
//
// The checks are the attempts to break the answer, all mechanical, from the record: is each sentence backed by a
// passage, is there a figure or name no source gives, do the sources disagree on the answer's figure, does each
// match rest on more than a couple of shared words (ground.falsify).
//
// SITE_TYPE: each source's passage is drawn in its own site's typesetting (title face, body face, colours), so a
// clipping reads as borrowed. Known sites are listed; anything else gets a neutral reading style.

import { sourceDocs, falsify } from "./fold-chat-ground.js";
import { falsifyAnswer, passagesOfRecord } from "./fold-chat-falsify-answer.js";

const BACKED = new Set(["corroborated", "held"]);
/** The cross-reference of a turn: every answer sentence tried against every source read (fold-chat-falsify-answer.js).
 *  Cached on the record, non-enumerable, so it is never persisted — always recomputed from what was read. */
export function crossCheckOf(rec) {
  if (!rec || rec.creative || rec.noClaims) return null;
  if (Object.prototype.hasOwnProperty.call(rec, "_fz")) return rec._fz;
  const resp = rec.facing?.response || [];
  let fz = null;
  if (resp.length) { try { fz = falsifyAnswer(resp.map((r) => r.text), passagesOfRecord(rec)); } catch { fz = null; } }
  try { Object.defineProperty(rec, "_fz", { value: fz, enumerable: false, configurable: true }); } catch {}
  return fz;
}
/** Passages for the facing page drawn from the sentences the cross-reference found STATING a claim (verbatim, from the page). */
function witnessSources(fz) {
  const out = [], seen = new Map();
  const tags = fz.claims.map(() => []);
  for (const c of fz.claims) {
    if (!BACKED.has(c.verdict)) continue;
    for (const w of c.witnesses) {
      if (w.verdict !== "states") continue;
      const src = fz.sources.find((s) => s.key === w.src) || {};
      const k = w.src + "\u0000" + w.sentence;
      if (!seen.has(k)) { const n = "S" + (out.length + 1); seen.set(k, n); out.push({ n, url: src.url || null, ref: src.ref, label: src.ref, domain: src.domain, before: "", mark: w.sentence, after: "" }); }
      tags[c.i].push(seen.get(k));
    }
  }
  return { sources: out, tags };
}

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";
const T = (o) => ({ bg: "#ffffff", ink: "#202122", edge: "#e4e4e9", rule: "#e4e4e9", mark: "#fdf0b0", title: SERIF, titleWeight: "400", titleCase: "none", titleTrack: "0", body: SERIF, bodySize: "15px", fav: "", favBg: "#f1f1f4", favFg: "#44444e", ...o });
export const SITE_TYPE = {
  "wikipedia.org": T({ ink: "#202122", edge: "#a2a9b1", rule: "#a2a9b1", mark: "#fef6e7", title: "'Linux Libertine','Georgia','Times',serif", body: SANS, fav: "W", favBg: "#ffffff", favFg: "#202122" }),
  "britannica.com": T({ ink: "#1a1a1a", edge: "#dcdcdc", rule: "#1a1a1a", mark: "#e6f0fa", titleWeight: "700", bodySize: "16px", fav: "B", favBg: "#0f4c81", favFg: "#ffffff" }),
  "gutenberg.org": T({ bg: "#fffffa", ink: "#1c1c1c", edge: "#e2dfd2", rule: "#e2dfd2", mark: "#f3ead0", title: "'Times New Roman',Times,serif", titleCase: "uppercase", titleTrack: ".08em", body: "'Times New Roman',Times,serif", bodySize: "16px", fav: "G", favBg: "#fffffa", favFg: "#5a4a2a" }),
  "worldatlas.com": T({ ink: "#2b2b2b", mark: "#e3f0ff", title: "'Trebuchet MS','Helvetica Neue',Arial,sans-serif", titleWeight: "700", body: "'Trebuchet MS','Helvetica Neue',Arial,sans-serif", fav: "A", favBg: "#2a6fb0", favFg: "#ffffff" }),
  "history.com": T({ ink: "#111111", rule: "#111111", mark: "#f3f3f3", title: "'Arial Narrow','Helvetica Neue',Arial,sans-serif", titleWeight: "700", titleCase: "uppercase", bodySize: "16px", fav: "H", favBg: "#111111", favFg: "#ffffff" }),
  "sparknotes.com": T({ ink: "#1b1b1b", mark: "#e7f1ff", title: SANS, titleWeight: "800", body: SANS, fav: "S", favBg: "#0b2a4a", favFg: "#ffffff" }),
  "litcharts.com": T({ ink: "#222222", mark: "#e6f4f1", title: SANS, titleWeight: "700", body: SERIF, fav: "L", favBg: "#00a19a", favFg: "#ffffff" }),
  "bbc.co.uk": T({ ink: "#141414", rule: "#141414", mark: "#fbe9e9", title: SANS, titleWeight: "700", body: SANS, fav: "B", favBg: "#000000", favFg: "#ffffff" }),
  "bbc.com": T({ ink: "#141414", rule: "#141414", mark: "#fbe9e9", title: SANS, titleWeight: "700", body: SANS, fav: "B", favBg: "#000000", favFg: "#ffffff" }),
  "theguardian.com": T({ ink: "#121212", rule: "#dcdcdc", mark: "#fff4d6", title: "Georgia,serif", titleWeight: "700", body: "Georgia,serif", bodySize: "16px", fav: "G", favBg: "#052962", favFg: "#ffffff" }),
  "nytimes.com": T({ ink: "#121212", mark: "#f2f2f2", title: "Georgia,'Times New Roman',serif", titleWeight: "700", body: "Georgia,'Times New Roman',serif", bodySize: "16px", fav: "T", favBg: "#ffffff", favFg: "#121212" }),
  "ncbi.nlm.nih.gov": T({ ink: "#212121", mark: "#eaf2fb", title: SANS, titleWeight: "700", body: SANS, fav: "N", favBg: "#20558a", favFg: "#ffffff" }),
  "nationalgeographic.com": T({ ink: "#111111", mark: "#fff6cc", title: SANS, titleWeight: "800", body: SERIF, fav: "N", favBg: "#ffce00", favFg: "#000000" }),
  "toureiffel.paris": T({ bg: "#1d2b3a", ink: "#f2ece0", edge: "#1d2b3a", rule: "#3a4a5c", mark: "#5a4a2a", title: "'Helvetica Neue',Helvetica,Arial,sans-serif", titleWeight: "700", titleCase: "uppercase", titleTrack: ".14em", body: "'Helvetica Neue',Helvetica,Arial,sans-serif", fav: "E", favBg: "#1d2b3a", favFg: "#c9a46a" }),
};
/** The typesetting for a domain: a listed site (or any of its subdomains), else the neutral reading style. */
export function typeOf(domain) {
  const d = String(domain || "").toLowerCase().replace(/^www\./, "");
  for (const k of Object.keys(SITE_TYPE)) if (d === k || d.endsWith("." + k)) return SITE_TYPE[k];
  return T({ fav: (d.charAt(0) || "?").toUpperCase() });
}

/** "…from the perspective of X", "in the voice of X", "as told by X": the ask wants the facts retold, partly invented. */
export const PERSPECTIVE_RE = /\b(?:from (?:the )?(?:perspective|point of view|viewpoint|eyes) of|through (?:the )?eyes of|in the voice of|as told by|as if (?:you were|told by)|in (?:his|her|their) (?:own )?words|from \w+'s (?:perspective|point of view))\b/i;

// ───────── figures, so the sources can be compared on the answer's own number ─────────
const UNITS = [[/^(?:m|metres?|meters?)$/i, "m"], [/^(?:ft|feet|foot)$/i, "ft"], [/^(?:km|kilomet(?:re|er)s?)$/i, "km"], [/^(?:mi|miles?)$/i, "mi"], [/^(?:kg|kilograms?)$/i, "kg"], [/^(?:lbs?|pounds?)$/i, "lb"], [/^(?:%|percent)$/i, "%"], [/^mg$/i, "mg"], [/^ml$/i, "ml"], [/^(?:°c|celsius)$/i, "°C"], [/^(?:°f|fahrenheit)$/i, "°F"], [/^(?:million|billion)$/i, null]];
const FIG = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(%|°[CF]|[A-Za-z]{1,11})/g;
export function figuresOf(text) {
  const out = [];
  for (const m of String(text || "").matchAll(FIG)) {
    const u = UNITS.find(([re]) => re.test(m[2]));
    if (!u || !u[1]) continue;
    out.push({ value: Number(m[1].replace(/,/g, "")), unit: u[1], raw: m[0] });
  }
  return out;
}
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const fmt = (v, unit) => `${v.toLocaleString("en")} ${unit}`;

/** Do the read pages agree on the answer's first figure? Each page that gives a figure in the same unit and within
 *  ±25% of the answer's (the same quantity, roughly) is grouped by the value it gives. Null when fewer than two pages
 *  give one. { unit, answer, answerLabel, groups: [{ value, label, sources: [{ ref, url, domain, site }] }] } */
export function agreementOf(answer, passages = []) {
  const a = figuresOf(answer)[0];
  if (!a || !a.value) return null;
  const by = new Map(), seen = new Set();
  for (const p of passages || []) {
    const url = p.url || p.source || "";
    const domain = domainOf(url);
    const key = domain || p.ref;
    if (!key || seen.has(key)) continue;
    const near = figuresOf(p.text).filter((f) => f.unit === a.unit && Math.abs(f.value - a.value) <= a.value * 0.25);
    if (!near.length) continue;
    seen.add(key);
    const pick = near.find((f) => f.value === a.value) || near[0];
    if (!by.has(pick.value)) by.set(pick.value, []);
    by.get(pick.value).push({ ref: p.ref || "", url, domain, site: String(p.ref || "").split(" \u2014 ")[0] || domain });
  }
  const total = [...by.values()].reduce((n, s) => n + s.length, 0);
  if (total < 2) return null;
  const groups = [...by.entries()].map(([value, sources]) => ({ value, label: fmt(value, a.unit), sources }))
    .sort((x, y) => (y.value === a.value) - (x.value === a.value) || y.sources.length - x.sources.length);
  return { unit: a.unit, answer: a.value, answerLabel: fmt(a.value, a.unit), groups };
}

/** The layout and the checks for a turn. Null when the turn has nothing to draw this way (no passages, or a gap). */
export function presentationOf(rec, { question = "" } = {}) {
  const face = rec?.facing;
  const creative = !!rec?.creative;
  if (!face) return null;
  const fz = creative ? null : crossCheckOf(rec);
  if (!(face.sources || []).length && !creative && fz && fz.summary.backed > 0) {
    // CROSS-REFERENCED: no passage was attached at write time, but sentences it read state the claims. Those sentences
    // become the facing page's passages, and the answer is drawn as grounded on them.
    const ws = witnessSources(fz);
    const resp2 = (face.response || []).map((r, i) => ({ ...r, grounded: BACKED.has(fz.claims[i]?.verdict), tag: ws.tags[i].join(" ") || r.tag }));
    const rec2 = { ...rec, facing: { ...face, sources: ws.sources, response: resp2 } };
    try { Object.defineProperty(rec2, "_fz", { value: fz, enumerable: false, configurable: true }); } catch {}
    const p = presentationOf(rec2, { question });
    if (p) { p.crossRef = true; p.response = resp2; }
    return p;
  }
  if (!(face.sources || []).length && !creative) {
    // UNSUPPORTED: it read pages but no sentence of the answer stands on them.
    const n0 = (face.response || []).length, read = Array.isArray(rec.web) ? rec.web.filter((w) => w.read && w.ok !== false).length : 0;
    if (!n0 || (!read && !rec.tape)) return null;
    const readPassages = (rec.tape || []).filter((e) => e.kind === "quick").map((e) => e.p);
    // IN ITS OWN WORDS: no sentence quotes a source, but the meaning check (claim read as a relation, held against the
    // relations the sources make) found the same thing said. That is a paraphrase, not an unsupported answer.
    const k6 = (rec.tape || []).find((e) => e.kind === "check" && e.k === 6);
    const mc = (k6 && k6.checks) || [];
    const LV = { same: "Same things, same relation", related: "Same things; the relation agrees in part", touches: "Names the same thing, says something else", none: "Nothing it read makes this claim" };
    const meant = mc.filter((c) => c.meaning && (c.meaning.level === "same" || c.meaning.level === "related"));
    if (meant.length) return { layout: "paraphrase", register: "research", docs: [], read, readPassages, meanChecks: mc, contested: meant.length < mc.length, counts: { sentences: n0, grounded: 0 },
      checks: mc.map((c, i) => { const lv = (c.meaning && c.meaning.level) || "none"; const site = String(c.ref || "").split(" \u2014 ")[0]; return { ok: lv === "same" || lv === "related", q: `s${i + 1} \u00b7 does it mean what a source says?`, a: `${LV[lv]}${site && lv !== "none" ? " \u00b7 " + site : ""}.` }; }) };
    return { layout: "unsupported", register: "research", docs: [], read, readPassages, contested: true, counts: { sentences: n0, grounded: 0 }, fz,
      checks: [{ ok: false, q: "Is each sentence backed by a passage?", a: `None of ${n0}. The model answered from memory.` }, ...(fz && fz.sources.length ? [{ ok: false, q: "Did any source state it, in other words?", a: `No: tried each sentence against ${fz.sources.length} source${fz.sources.length === 1 ? "" : "s"}; none states it.` }] : [])] };
  }
  const docs = sourceDocs(face.sources);
  const resp = face.response || [];
  const n = resp.length;
  // a sentence is backed when it was attached to a passage at write time OR the cross-reference finds a source stating it
  // — unless a source contradicts it
  const fzv = (i) => fz?.claims[i]?.verdict;
  const g = resp.filter((r, i) => fzv(i) !== "contested" && (r.grounded || BACKED.has(fzv(i)))).length;
  const mixed = false;
  const ag = rec.agreement && Array.isArray(rec.agreement.groups) && rec.agreement.groups.length ? rec.agreement : null;
  const split = !!(ag && ag.groups.length > 1);
  const others = ag && !split ? ag.groups[0].sources.length - 1 : docs.length - 1;
  const layout = rec.book ? "book" : creative ? "creative" : mixed ? "mixed" : split ? "split" : others < 1 ? "one" : "agree";

  const checks = [];
  if (creative) return { layout, register: "creative", docs, checks, agreement: null, contested: false, counts: { sentences: n, grounded: g } };
  if (rec.book) { const b = rec.book; checks.push({ ok: b.used > 0, q: "Did it read the whole book?", a: `Yes: all ${b.paras.toLocaleString("en")} paragraphs. ${b.matched} mention ${b.names.join(" and ")} together, across ${b.chapters} chapters; the ${b.used} strongest were used.` }); }
  if (mixed) checks.push({ ok: true, q: "Which parts are invented?", a: n - g ? `${n - g} of ${n} sentences are imagined; ${g} come from the sources.` : `None: all ${n} sentences come from the sources.` });
  else checks.push({ ok: g === n, q: "Is each sentence stated by a source?", a: g === n ? `Yes, all ${n}.` : `${g} of ${n}. The rest: no source states them.` });
  if (fz && fz.sources.length) {
    const S = fz.summary, contra = fz.claims.flatMap((c) => c.witnesses.filter((w) => w.verdict === "contradicts").map((w) => ({ c, w })));
    const site = (k) => String((fz.sources.find((s) => s.key === k) || {}).ref || k).split(" \u2014 ")[0];
    checks.push({ ok: !contra.length, q: "Does any source contradict it?", a: contra.length ? `Yes: ${site(contra[0].w.src)} ${contra[0].w.why} (s${contra[0].c.i + 1}).` : `No. Each sentence was tried against all ${fz.sources.length} source${fz.sources.length === 1 ? "" : "s"}.` });
    if (S.backed) checks.push({ ok: true, q: "How many independent sources state it?", a: S.corroborated === S.backed ? `Two or more for every backed sentence.` : `${S.corroborated} sentence${S.corroborated === 1 ? "" : "s"} by 2+ sources; ${S.held} by one.` });
    const armed = fz.claims.filter((c) => c.swap.armed), bad = armed.filter((c) => !c.swap.discriminates);
    checks.push(armed.length
      ? { ok: !bad.length, q: "Would a wrong version pass too?", a: bad.length ? `Yes: “${bad[0].swap.to}” in place of “${bad[0].swap.from}” matches the source just as well. Read s${bad[0].i + 1} loosely.` : `No. Swapped ${armed.length === 1 ? `“${armed[0].swap.from}” for “${armed[0].swap.to}”` : `a figure or name in ${armed.length} sentences`}; the sources tell them apart.` }
      : { ok: true, q: "Would a wrong version pass too?", a: "Not testable: no figure or name to swap." });
  }
  const OPENERS = /^(?:According|However|Although|Because|While|When|After|Before|Since|During|In|On|At|The|This|That|These|Those|It|As|If|But|And|So|Yet|Also|Some|Many|Most|Others?)$/;
  const un = [...(rec.unsupported?.numbers || []), ...(rec.unsupported?.names || []).filter((nm) => !OPENERS.test(String(nm).trim()))];
  checks.push({ ok: !un.length, q: "Any figure or name no source gives?", a: un.length ? un.slice(0, 4).join(", ") + "." : "None." });
  if (ag && !rec.book) checks.push(split
    ? { ok: false, q: "Do the sources disagree?", a: `Yes: ${ag.groups.map((x) => `${x.label} in ${x.sources.length}`).join(", ")}.` }
    : { ok: true, q: "Do the sources disagree?", a: `No. ${ag.groups[0].sources.length} pages give ${ag.groups[0].label}.` });
  else if (docs.length > 1 && !rec.book) checks.push({ ok: true, q: "Do the sources disagree?", a: `No conflicting figures across ${docs.length} sources.` });
  void falsify;
  return { layout, register: "research", docs, checks, agreement: ag, contested: checks.some((c) => !c.ok), counts: { sentences: n, grounded: g }, fz, response: resp };
}

// ───────── salience: which sentences of a passage are worth reading closely ─────────
const BOILER = /\b(?:our|we|us|you|your|subscribe|newsletter|channel|click|cookies?|sign up|log ?in|follow us|read more|share this|advertis\w*|sponsored|copyright|all rights)\b/i;
const FUNCW = new Set("the a an and or but of in to with by for on at from as is are was were be been being has have had it its this that these those which who what when where why how than then so also there their they he she we you i".split(" "));
/** The n sentences of `text` that carry the most about `query`: words shared with the query count most, then names and
 *  figures, then content density; site boilerplate ("on our channel", "subscribe") and fragments score down. */
export function salientSentences(text, query, n = 3) {
  const q = new Set((String(query).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !FUNCW.has(w)));
  const sents = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[\p{Lu}\d"“(])/u).map((s) => s.trim()).filter((s) => s.length >= 30 && s.length <= 360);
  const scored = sents.map((s, i) => {
    const words = s.match(/[\p{L}\p{N}]+/gu) || [];
    const content = words.filter((w) => w.length > 3 && !FUNCW.has(w.toLowerCase()));
    const hits = new Set(content.map((w) => w.toLowerCase()).filter((w) => q.has(w))).size;
    const names = words.slice(1).filter((w) => /^\p{Lu}/u.test(w)).length;
    const figs = (s.match(/\d/g) || []).length ? 1 : 0;
    const density = words.length ? content.length / words.length : 0;
    const score = hits * 4 + Math.min(3, names) * 0.6 + figs * 0.8 + density * 2 - (BOILER.test(s) ? 4 : 0) - (words.length < 7 ? 2 : 0);
    return { s, i, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.s);
}

// ───────── THE NINE FALSIFIERS: how a fact fails at each operator, and the test that would show it ─────────
// Each row is run mechanically from the turn's record where the record can run it; where it cannot, the row says so
// (a refusal or a gap is not a falsehood, and "no null, no verdict").
const NEG = /\b(?:not|no|never|neither|nor|none|without|n't)\b/i;
const CMP = /\b(?:highest|lowest|most|least|largest|smallest|biggest|best|worst|first|last|only|rising|falling|increas\w*|decreas\w*|more than|less than|fewer than|lower than|higher than|greater than|compared (?:to|with)|record)\b/i;
const CAUSE = /\b(?:because|caused|causes|led to|leads to|resulted in|due to|therefore|so that|total(?:led|s)?|in all|altogether)\b/i;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const QUOTE = /[“"]([^”"]{8,})[”"]/g;
const DEF_STOP = new Set("about above after again against along among around because before being below between could during every first found given great having their there these those through under until using various where which while whose would which other often still since since".split(" "));
export const FALSIFIERS = [
  ["NUL", "Does what it presupposes exist?", "show the referent is absent \u2014 a typed gap, false only if the record is complete for that scope"],
  ["SIG", "Did anything ever mark it?", "no traceable source \u2014 a refusal, not a falsehood"],
  ["INS", "Is each cited instance what it is cited as?", "check the quoted words and their address against the bytes"],
  ["SEG", "Is the boundary right \u2014 date, place, entity?", "re-cut to the right scope; stale facts die here"],
  ["CON", "Does the link hold, with the same polarity?", "a contradicted edge, or a competing subject in a one-filler slot"],
  ["SYN", "Does the whole hold, not just its parts?", "recompute the whole and test each link"],
  ["DEF", "Is each term used inside its definition?", "fix the definition and re-read for the same for-whom"],
  ["EVA", "Does the comparison hold against a null?", "run it against the declared null \u2014 no null, no verdict"],
  ["REC", "Is it still true on the rebuilt ground?", "re-derive the ground and re-run \u2014 covers retractions and updates"],
];
/** status: held | failed | gap | refused | open (cannot be run from this record) | n/a (nothing of that kind in the answer) */
export function falsifiersOf(rec, { meanChecks = null, fz = null } = {}) {
  const resp = rec?.facing?.response || [], text = resp.map((r) => r.text).join(" ");
  const n = resp.length, g = resp.filter((r) => r.grounded).length;
  const mc = meanChecks || ((rec?.tape || []).find((e) => e.kind === "check" && e.k === 6)?.checks) || [];
  const meant = mc.filter((c) => c.meaning && (c.meaning.level === "same" || c.meaning.level === "related")).length;
  fz = fz || crossCheckOf(rec);
  const backed = Math.max(g, meant, fz ? fz.summary.backed : 0);
  const OPENERS = /^(?:According|However|Although|Because|While|When|After|Before|Since|During|In|On|At|The|This|That|These|Those|It|As|If|But|And|So|Yet|Also|Some|Many|Most|Others?)$/;
  const witnessed = new Set((fz?.claims || []).filter((c) => BACKED.has(c.verdict)).flatMap((c) => c.figures.map((f) => String(f).replace(/,/g, "").toLowerCase())));
  const names = (rec?.unsupported?.names || []).filter((nm) => !OPENERS.test(String(nm).trim())), nums = (rec?.unsupported?.numbers || []).filter((x) => !witnessed.has(String(x).replace(/,/g, "").toLowerCase()));
  const out = [];
  const row = (i, status, found) => out.push({ op: FALSIFIERS[i][0], q: FALSIFIERS[i][1], test: FALSIFIERS[i][2], status, found });
  row(0, names.length ? "gap" : "held", names.length ? `${names.slice(0, 3).join(", ")} \u2014 named in the answer, absent from everything it read (a gap, not proof of absence)` : "everything the answer names appears in what it read");
  row(1, backed === n ? "held" : backed ? "refused" : "refused", backed === n ? `all ${n} sentences trace to a source` : `${n - backed} of ${n} sentences trace to no source \u2014 refused, not shown false`);
  const quotes = [...text.matchAll(QUOTE)].map((m) => m[1]);
  const srcText = (rec?.facing?.sources || []).map((s) => [s.before, s.mark, s.after].join(" ")).join(" ").toLowerCase();
  const badQ = quotes.filter((q) => !srcText.includes(q.toLowerCase()));
  row(2, badQ.length ? "failed" : (rec?.facing?.sources || []).length ? "held" : "n/a", badQ.length ? `quoted words not found in the bytes: \u201c${badQ[0].slice(0, 50)}\u201d` : quotes.length ? `${quotes.length} quotation${quotes.length === 1 ? "" : "s"} found verbatim` : "every cited passage is checked to occur in the page it came from");
  const ag = rec?.agreement && rec.agreement.groups?.length > 1 ? rec.agreement : null;
  row(3, nums.length ? "failed" : ag ? "gap" : "held", nums.length ? `${nums.slice(0, 3).join(", ")} \u2014 a figure no source gives` : ag ? `sources give ${ag.groups.map((x) => x.label).join(" / ")} \u2014 different moments or scopes; the answer's must be re-cut to its scope` : "dates and figures match the sources' own");
  // a polarity flip only when the negation governs something the claim says: a content word of the claim within the four
  // words after the source's (or the claim's) "not"
  const scopeHas = (neg, other) => { const ow = new Set((String(other).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || [])); const ws = String(neg).toLowerCase().split(/\s+/); return ws.some((w, i) => NEG.test(w) && ws.slice(i + 1, i + 5).some((x) => ow.has(x.replace(/[^\p{L}\p{N}]/gu, "")))); };
  const flips = mc.filter((c) => c.meaning?.sourceSentence && NEG.test(c.s) !== NEG.test(c.meaning.sourceSentence) && (c.meaning.level === "same" || c.meaning.level === "related") && (NEG.test(c.s) ? scopeHas(c.s, c.meaning.sourceSentence) : scopeHas(c.meaning.sourceSentence, c.s)));
  const off = mc.filter((c) => c.meaning && c.meaning.level === "touches");
  const fzContra = (fz?.claims || []).flatMap((c) => c.witnesses.filter((w) => w.verdict === "contradicts").map((w) => ({ c, w })));
  if (fzContra.length) row(4, "failed", `s${fzContra[0].c.i + 1}: ${fzContra[0].w.src} ${fzContra[0].w.why}`);
  else if (!mc.length && fz?.claims?.length) { const linked = fz.claims.filter((c) => c.witnesses.some((w) => w.verdict === "states")); row(4, linked.length ? "held" : "gap", linked.length ? `${plural(linked.length, "claim")} link the same things a source links, read in the cross-reference` : "no claim's link is stated by a source \u2014 a gap, not a contradiction"); }
  else row(4, flips.length ? "failed" : off.length ? "gap" : mc.length ? "held" : "gap", flips.length ? `s${mc.indexOf(flips[0]) + 1} reverses the source's polarity (one says not, the other does not)` : off.length ? `${off.length} claim${off.length === 1 ? "" : "s"} name the same thing but link it to something else` : mc.length ? "each link matches a link a source makes, same direction" : "links not read as relations in this turn");
  const chain = resp.filter((r) => CAUSE.test(r.text));
  const brokenChain = chain.filter((r) => !r.grounded && !mc.some((c) => c.s === r.text && c.meaning && c.meaning.level !== "none" && c.meaning.level !== "touches"));
  row(5, !chain.length ? "n/a" : brokenChain.length ? "failed" : "held", !chain.length ? "no total or causal chain in the answer" : brokenChain.length ? `${brokenChain.length} link${brokenChain.length === 1 ? "" : "s"} of a causal chain stand on no source` : `each link of ${chain.length} causal step${chain.length === 1 ? "" : "s"} is sourced`);
  // DEF: each term the answer leans on, against the definition the material gives for it ("X is …", "X refers to …").
  // Used inside it: the answer's sentence shares the definition's content. No definition read: a gap, never "true".
  const readTxt = [...(rec?.tape || []).filter((e) => e.kind === "quick").map((e) => String(e.p?.text || "")), ...(rec?.facing?.sources || []).map((s) => [s.before, s.mark, s.after].join(" "))].map((x) => x.slice(0, 4000));
  const cw = (s) => new Set((String(s).toLowerCase().match(/[\p{L}]{5,}/gu) || []).filter((w) => !DEF_STOP.has(w)));
  const terms = [...cw(text)].slice(0, 12);
  const defd = [];
  const DEF_RX = /^[\p{L}-]+\b[^.]{0,30}?\b(?:is|are|refers to|means|is defined as)\b([^.]{8,160})/iu;
  for (const t of terms) {
    for (const x of readTxt) {
      const low = x.toLowerCase(); let at = low.indexOf(t), hit = null;
      for (let k = 0; at >= 0 && k < 6 && !hit; k++, at = low.indexOf(t, at + t.length)) { if (at > 0 && /[\p{L}]/u.test(low[at - 1])) continue; const m = DEF_RX.exec(x.slice(at, at + 220)); if (m) hit = m[1]; }
      if (hit) { defd.push({ t, d: hit }); break; }
    }
    if (defd.length >= 5) break;
  }
  const drift = defd.filter(({ t, d }) => { const sent = resp.find((r) => r.text.toLowerCase().includes(t))?.text || ""; const dw = cw(d); return ![...cw(sent)].some((w) => w !== t && dw.has(w)); });
  row(6, !defd.length ? "gap" : drift.length ? "gap" : "held", !defd.length ? "none of the answer's terms is defined in what it read \u2014 their sense is the model's" : drift.length ? `\u201c${drift[0].t}\u201d is used outside the sense its source gives (\u201c${drift[0].d.trim().slice(0, 60)}\u201d)` : `${plural(defd.length, "term")} used inside the definitions the sources give: ${defd.map((x) => x.t).slice(0, 3).join(", ")}`);
  const cmp = resp.filter((r) => CMP.test(r.text));
  const armed = (fz?.claims || []).filter((c) => c.swap.armed), loose = armed.filter((c) => !c.swap.discriminates);
  if (armed.length) row(7, loose.length ? "failed" : "held", loose.length ? `swapped “${loose[0].swap.from}” for “${loose[0].swap.to}” and the source still matched — it does not tell them apart` : `swapped a ${armed[0].swap.kind} for a competitor from the same source in ${plural(armed.length, "sentence")}; the wrong version no longer matched`);
  else if (cmp.length && !ag) {
    // the NULL a comparison is read against is its baseline: held when a source states that baseline figure
    const srcAll = readTxt.join(" ").toLowerCase();
    const figs = cmp.flatMap((r) => (r.text.match(/\d[\d,.]*\s?(?:\u00b0[CF]|%|[a-z]{1,3})?/gi) || []).map((x) => x.trim().toLowerCase()));
    const base = figs.find((f) => srcAll.includes(f));
    row(7, base ? "held" : "gap", base ? `the comparison's baseline (${base}) is stated by a source \u2014 the null it is read against` : `${cmp.length} comparison${cmp.length === 1 ? "" : "s"} (\u201c${(cmp[0].text.match(CMP) || [""])[0]}\u201d) with no baseline in what it read`);
  }
  else if (!cmp.length && fz?.claims?.length) row(7, "gap", "no rival figure or name of the same kind in what it read, so the swap could not run \u2014 not a pass, and not a failure");
  else row(7, cmp.length ? "failed" : "n/a", cmp.length ? (ag ? "the comparison rests on figures the sources disagree on" : `${cmp.length} comparison${cmp.length === 1 ? "" : "s"} (\u201c${(cmp[0].text.match(CMP) || [""])[0]}\u201d) with no declared null \u2014 no verdict`) : "no comparison or magnitude claimed");
  if (fz && fz.sources.length) { const S = fz.summary; row(8, S.contested ? "failed" : S.backed < S.claims ? "gap" : "held", `cross-referenced against ${plural(fz.sources.length, "source")}: ${S.corroborated} corroborated, ${S.held} on one source${S.weak ? `, ${S.weak} weak` : ""}${S.contested ? `, ${S.contested} contested` : ""}${S.unsupported ? `, ${S.unsupported} unstated` : ""}`); }
  else row(8, "held", "the ground is this turn's reading \u2014 re-ask to re-derive it; nothing older is reused");
  // ── the other two grains: GROUND (the whole record) and PATTERN (across sources and time) ──
  const tape = rec?.tape || [];
  const read = tape.filter((e) => e.kind === "quick").map((e) => e.p).filter(Boolean);
  const dom = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const domains = [...new Set(read.map((x) => dom(x.url)).filter(Boolean))];
  const engines = [...new Set(tape.filter((e) => e.kind === "st" && e.st?.phase === "found").map((e) => e.st.scope))];
  const backedSrc = [...new Set([...(rec?.facing?.sources || []).map((s) => dom(s.url)), ...mc.filter((c) => c.meaning && c.meaning.level !== "none" && c.meaning.level !== "touches").map((c) => dom(c.source))].filter(Boolean))];
  const years = [...new Set(read.flatMap((x) => String(x.text).match(/\b(1[5-9]\d\d|20\d\d)\b/g) || []))].map(Number).sort((a, b) => a - b);
  const marks = (rec?.facing?.sources || []).map((s) => String(s.mark || "").toLowerCase()).filter((m) => m.length > 20);
  const copies = marks.filter((m) => read.filter((x) => String(x.text).toLowerCase().includes(m)).length > 1).length;
  const defs = read.filter((x) => /\b(?:is defined as|refers to|is a term|means that|is the name for|\bis an?\b)/i.test(x.text)).length;
  const totals = read.filter((x) => /\b(?:in total|totall?ed|altogether|sum of|overall)\b/i.test(x.text)).length;
  const missIn = names.length ? read.filter((x) => !names.some((nm) => String(x.text).includes(nm))).length : 0;
  const cell = (status, found) => ({ status, found });
  const GP = [
    [cell("open", "no claim the record is complete for this scope \u2014 absence here is a gap, not a fact"), names.length ? cell(missIn >= 2 ? "gap" : "open", `absent from ${missIn} of ${read.length} independent pages`) : cell("n/a", "nothing absent to repeat")],
    [cell(read.length ? "held" : "refused", `${plural(read.length, "page")} read from ${plural(domains.length, "site")}${engines.length ? " via " + engines.join(", ") : ""}`), backedSrc.length > 1 ? cell("held", `attested by ${backedSrc.length} different sites: ${backedSrc.slice(0, 3).join(", ")}`) : backedSrc.length === 1 ? cell("gap", `every attestation traces to one site (${backedSrc[0]})`) : cell("refused", "no attestation to trace")],
    [cell(read.length ? "held" : "open", read.length ? "pages fetched whole and cut to passages; nothing was paraphrased into the record" : "no document to authenticate"), marks.length ? cell(copies ? "held" : "gap", copies ? `${copies} cited passage${copies === 1 ? "" : "s"} appear verbatim in more than one page` : "each cited passage appears in one page only") : cell("n/a", "no cited passage")],
    [cell(years.length ? "held" : "open", years.length ? `the record spans ${years[0]}${years.length > 1 ? "\u2013" + years[years.length - 1] : ""}` : "no dates in what it read to bound the scope"), cell("open", "the cut is not re-checked against later records")],
    [cell(mc.length ? "held" : "open", mc.length ? `${plural(mc.length, "claim")} read as relations against the sources'` : "relations not read in this turn"), ag && ag.groups.length === 1 && ag.groups[0].sources.length > 1 ? cell("held", `${ag.groups[0].sources.length} independent pages bind the same value`) : ag ? cell("failed", "independent pages bind different values") : cell("open", "only one source per edge was compared")],
    [cell(totals ? "held" : "n/a", totals ? `${totals} page${totals === 1 ? "" : "s"} state a total` : "no totals stated"), cell(chain.length ? "open" : "n/a", chain.length ? "the composition is not compared across periods" : "nothing composed")],
    [cell(defs ? "held" : "open", defs ? `${defs} page${defs === 1 ? "" : "s"} carry a definition` : "no definitions carried by what it read"), cell("open", "usage drift across the document is not measured")],
    [cell(cmp.length ? "open" : "n/a", cmp.length ? "no baseline declared for this measure" : "no measure to set a baseline for"), cell(cmp.length ? "open" : "n/a", cmp.length ? "no held-out cases" : "nothing to hold out")],
    [cell("held", "the ground was rebuilt this turn"), cell("open", "later updates are not tracked yet \u2014 re-ask to re-run")],
  ];
  const RANK = { failed: 5, refused: 4, gap: 3, open: 1, held: 2, "n/a": 0 };
  out.forEach((r, i) => { r.figure = { status: r.status, found: r.found }; r.ground = GP[i][0]; r.pattern = GP[i][1]; r.worst = [r.ground, r.figure, r.pattern].reduce((a, b) => (RANK[b.status] > RANK[a.status] ? b : a)).status; });
  return out;
}
export const FALSIFIER_GRID = [
  ["Is the record complete for this scope?", "Does the named referent exist in it?", "Is the same absence repeated across independent records?"],
  ["What sources exist for this scope at all?", "Does any source attest this claim?", "Do the attestations trace to one upstream, or several?"],
  ["Is the document itself authentic and intact?", "Is the quoted passage at the cited address?", "Does it appear verbatim in copies, or only in derivatives?"],
  ["Where do the scope and date boundaries fall?", "Is the claim cut at the right entity, date and jurisdiction?", "Does the cut hold as records update?"],
  ["What relations does the record bind in general?", "Is this edge bound, absent, or opposite?", "Do independent sources bind the same edge with the same polarity?"],
  ["What totals does the record state?", "Do the parts sum to the claimed whole?", "Does the composition hold across periods?"],
  ["What definitions does the record carry?", "Is the term used within its definition here?", "Does usage drift across the document?"],
  ["What is the baseline or null for this measure?", "Does the comparison beat it?", "Does it keep beating it on held-out cases?"],
  ["Has the ground been rebuilt since?", "Does the claim survive the rebuilt ground?", "Do later updates keep it or reverse it?"],
];
