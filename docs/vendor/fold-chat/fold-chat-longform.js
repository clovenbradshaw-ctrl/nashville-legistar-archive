// fold-chat-longform.js — the agent's two open-ended lanes, for asks the block kit has no plan for.
//   ESSAY   plan → read sources → draft ONE section at a time from numbered facts → check every sentence against the
//           fact it cites (shared words, every figure present) → cut what fails → assemble with a reference list.
//           The model writes sentences; it never states a source, a figure or a quote the page did not give it.
//   EXTRACT a URL → the page's own tables, lists, links and structured data, parsed by the app (no model), with
//           CSV / JSON to download. Works from this machine's own fetch (extension / bridge) or the page text.
import * as web from "./fold-chat-web.js";

const STOP = new Set("about after also been before being between both could does each from have into more most much only other over such than that their them then there these they this those through very were what when where which while will with would your".split(" "));
export const words = (s) => (String(s).toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !STOP.has(w));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** "essay" | "extract" | null — declared words, nothing guessed. */
export function longKind(ask) {
  const q = String(ask || "");
  if (URL_RE.test(q) && /\b(parse|extract|scrape|pull|table|list|csv|json|data|prices?|links?|headlines?|read|get|collect|structure)\b/i.test(q)) return "extract";
  if (/\b(write|draft|compose|produce|make|create)\b/i.test(q) && /\b(essay|article|paper|long[- ]?form|blog post|analysis|write-?up|research)\b/i.test(q)) return "essay";
  return null;
}
export const urlOf = (ask) => { let u = (URL_RE.exec(String(ask || "")) || [null])[0]; if (!u) return null; u = u.replace(/[.,;:!?]+$/, ""); while (u.endsWith(")") && (u.match(/\(/g) || []).length < (u.match(/\)/g) || []).length) u = u.slice(0, -1); return u; };
export function topicOf(ask) {
  const t = one(ask).replace(urlOf(ask) || "", "").replace(/^(please\s+)?(write|draft|compose|make|create|produce)\s+(me\s+)?(an?|the)?\s*(long[- ]?form\s+)?(essay|article|paper|blog post|analysis|write-?up|research)?\s*(of\s+\d+\s+words\s+)?(about|on|regarding|covering)?\s*/i, "").replace(/[.?!]+$/, "").trim();
  return t || one(ask);
}

/* ============================ ESSAY ============================ */
const sentencesOf = (t) => one(t).split(/(?<=[.!?])\s+(?=[A-Z0-9"\u201c(])/).map((s) => s.trim()).filter((s) => s.length >= 40 && s.length <= 380 && !/cookie|subscribe|sign up|javascript|\u00a9|all rights|click here/i.test(s));
const overlap = (a, bSet) => { let n = 0; for (const w of a) if (bSet.has(w)) n++; return n; };
const nums = (s) => (String(s).match(/\d[\d,.]*\d|\d/g) || []).map((x) => x.replace(/,/g, ""));

/** The checkpoint for one drafted sentence: it must cite facts that exist, share most of its content words with them,
 *  and carry no figure the cited facts do not. Returns { ok, refs, text, why }. */
export function checkSentence(raw, facts) {
  const refs = []; const text = one(String(raw).replace(/\[(\d+(?:\s*[,;]\s*\d+)*)\]/g, (_, g) => { for (const x of g.split(/[,;]/)) refs.push(+x); return ""; })).replace(/\s+([.,;!?])/g, "$1");
  if (text.length < 25) return { ok: false, why: "too short" };
  const cited = [...new Set(refs)].filter((i) => facts[i - 1]);
  if (!cited.length) return { ok: false, text, why: "cites no fact" };
  const hay = cited.map((i) => facts[i - 1].text).join(" "); const hayW = new Set(words(hay)), mine = words(text);
  const share = mine.length ? overlap(mine, hayW) / mine.length : 0;
  if (share < 0.45) return { ok: false, text, why: `only ${Math.round(share * 100)}% of its words are in the fact it cites` };
  const hn = new Set(nums(hay)); const bad = nums(text).filter((n) => !hn.has(n));
  if (bad.length) return { ok: false, text, why: `the figure ${bad[0]} is not in the cited fact` };
  return { ok: true, text, refs: cited };
}

function renderEssay(doc) {
  const order = []; const num = (si) => { let k = order.indexOf(si); if (k < 0) { order.push(si); k = order.length - 1; } return k + 1; };
  const body = doc.sections.map((s) => `<section><h2>${esc(s.h)}</h2><p>${s.sentences.map((x) => esc(x.text) + (x.refs.length ? x.refs.map((r) => `<sup><a href="#r${num(doc.facts[r - 1].src)}">${num(doc.facts[r - 1].src)}</a></sup>`).filter((v, i, a) => a.indexOf(v) === i).join("") : "") + (x.quoted ? " <em class=q>(quoted)</em>" : "")).join(" ")}</p></section>`).join("");
  const refs = order.map((si, i) => `<li id="r${i + 1}"><a href="${esc(doc.sources[si].url)}" target="_blank" rel="noopener">${esc(doc.sources[si].title || doc.sources[si].url)}</a></li>`).join("");
  return `<!doctype html><meta charset=utf-8><title>${esc(doc.title)}</title><style>body{font:17px/1.7 Georgia,serif;max-width:680px;margin:48px auto;padding:0 24px;color:#1b1b1f}h1{font:700 32px/1.2 system-ui,sans-serif;margin:0 0 6px}h2{font:700 20px system-ui,sans-serif;margin:32px 0 8px}.by{font:13px system-ui;color:#666;margin-bottom:24px}sup a{color:#0d7a70;text-decoration:none;font:600 11px system-ui;padding:0 1px}.q{color:#666;font-size:14px}ol{font:14px/1.6 system-ui,sans-serif;padding-left:20px}ol a{color:#0d7a70}p{margin:0}</style><h1>${esc(doc.title)}</h1><div class=by>${doc.sections.length} sections · ${order.length} sources · every sentence checked against the source it cites</div>${body}<h2>Sources</h2><ol>${refs}</ol>`;
}
const essayMd = (doc) => { const html = renderEssay(doc); void html; const order = []; const num = (si) => { let k = order.indexOf(si); if (k < 0) { order.push(si); k = order.length - 1; } return k + 1; };
  const b = doc.sections.map((s) => `## ${s.h}\n\n${s.sentences.map((x) => x.text + (x.refs.length ? " " + [...new Set(x.refs.map((r) => `[${num(doc.facts[r - 1].src)}]`))].join("") : "")).join(" ")}`).join("\n\n");
  return `# ${doc.title}\n\n${b}\n\n## Sources\n\n${order.map((si, i) => `${i + 1}. [${doc.sources[si].title || doc.sources[si].url}](${doc.sources[si].url})`).join("\n")}\n`; };
const essayOut = (doc) => ({ html: renderEssay(doc), files: [{ name: "essay.md", mime: "text/markdown", text: essayMd(doc) }], doc });

const FALLBACK_HEADS = ["Background", "Key points", "Considerations", "Impact", "Debates", "Examples", "Context", "Outlook", "Origins", "Legacy", "Methods", "Limits"];
/** How long: "1500 words", "10 sections", "longer"/"in depth". Words ≈ 100 per section (four restated sentences). */
export function lengthOf(ask, base = 4) {
  const q = String(ask || ""); const w = /(\d[\d,]{2,5})\s*(?:-|\s)?words?/i.exec(q), s = /(\d{1,2})\s*(?:sections|parts|chapters|paragraphs)/i.exec(q);
  if (s) return Math.max(2, Math.min(16, +s[1]));
  if (w) return Math.max(2, Math.min(16, Math.round(+w[1].replace(/,/g, "") / 100)));
  return /\b(long|longer|in[- ]depth|detailed|thorough|comprehensive|extensive)\b/i.test(q) ? base * 2 : base;
}
function parseHeads(raw, n = 3) {
  const out = []; for (const l of String(raw || "").split("\n")) { const h = one(l.replace(/^[\s\-*\d.)#]+/, "").replace(/[*_`"]/g, "").replace(/[:.]+$/, "")); if (h.length >= 3 && h.length <= 40 && h.split(" ").length <= 5 && !out.some((x) => x.toLowerCase() === h.toLowerCase())) out.push(h); }
  return out.slice(0, n);
}

async function draftSection({ h, topic, facts, pick, complete, signal, onNote }) {
  // One fact at a time: the model restates a single sentence; the app knows which fact it rests on, so the citation is the app's.
  const kept = [];
  for (const f of pick) {
    if (signal?.aborted) break;
    let ok = null;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      const raw = await complete([{ role: "user", content: `Restate this sentence in your own plain words as ONE sentence. Keep every name and number exactly. Add nothing.\n\nSentence: ${f.text}\n\nRestated:` }], { maxTokens: 90, signal, stop: "line" });
      const text = one(String(raw).replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0]);
      const v = checkSentence(text + " [1]", [f]);
      if (v.ok && text.toLowerCase() !== f.text.toLowerCase()) ok = { text: v.text, refs: [facts.indexOf(f) + 1] };
      else onNote?.(`cut: \u201c${(v.text || text).slice(0, 90)}\u201d \u2014 ${v.ok ? "it only repeats the source" : v.why}`);
    }
    kept.push(ok || { text: f.text, refs: [facts.indexOf(f) + 1], quoted: true });
  }
  return kept;
}

let _memo = null;
/** runEssay(ask, { complete, signal, onStep, onLive }) → { ok, html, files, doc, why } */
export async function runEssay(ask, { complete, signal = null, onStep = () => {}, onLive = () => {}, searchWeb = web.searchWeb } = {}) {
  const topic = topicOf(ask); const nSec = lengthOf(ask);
  onLive(`reading the web for “${topic.slice(0, 50)}”`);
  _memo = _memo || web.makeMemo();
  const found = await searchWeb(topic, { effort: web.normEffort("deep", "balanced"), memo: _memo, onStep: (s) => { if (s.phase === "reading") onLive(`reading ${s.site || s.url}`); } });
  if (signal?.aborted) return { ok: false, why: "stopped" };
  const sources = []; const facts = []; const seen = new Set(); const tset = new Set(words(topic));
  const add = (text, p) => { let si = sources.findIndex((s) => s.url === p.url); if (si < 0) { sources.push({ url: p.url, title: p.title || p.ref || p.url }); si = sources.length - 1; } for (const s of sentencesOf(text)) { const k = s.toLowerCase(); if (seen.has(k)) continue; seen.add(k); facts.push({ text: s, src: si, sc: overlap(words(s), tset) }); } };
  for (const p of found.passages || []) add(p.text, { url: p.url, title: String(p.ref || "").split(" \u2014 ").pop() });
  for (const pg of found.pages || []) { const ranked = sentencesOf(pg.text).map((s) => ({ s, sc: overlap(words(s), tset) })).sort((a, b) => b.sc - a.sc).slice(0, 14).map((x) => x.s); add(ranked.join(" "), { url: pg.url, title: String(pg.ref || "").split(" \u2014 ").pop() }); }
  const nPages = (found.pages || []).length;
  onStep({ label: "sources", by: "app", ok: facts.length >= 4, text: "", notes: [`${nPages} page${nPages === 1 ? "" : "s"} read, ${facts.length} checkable sentences from ${sources.length} source${sources.length === 1 ? "" : "s"}`], errors: facts.length >= 4 ? [] : [{ code: "no sources", msg: facts.length ? "too little was read to write from" : `nothing readable was found for “${topic}”. The model does not write without sources`, fix: "" }] });
  if (facts.length < 4) return { ok: false, why: "no sources" };
  // the plan: an overview, then headings the model proposes (the app falls back to fixed ones)
  onLive("planning the sections");
  let heads = [];
  try { heads = parseHeads(await complete([{ role: "user", content: `Give ${nSec - 1} short section headings (two to four words each, all different) for an essay about "${topic}". One per line. No numbers, no commentary.` }], { maxTokens: 20 + 12 * nSec, signal, stop: "none" }), nSec - 1); } catch (e) { if (signal?.aborted) return { ok: false, why: "stopped" }; }
  const modelHeads = heads.length >= Math.min(2, nSec - 1); if (!modelHeads) heads = FALLBACK_HEADS.slice(0, nSec - 1); else if (heads.length < nSec - 1) heads = [...heads, ...FALLBACK_HEADS.filter((h) => !heads.some((x) => x.toLowerCase() === h.toLowerCase()))].slice(0, nSec - 1);
  const plan = ["Overview", ...heads];
  onStep({ label: "outline", by: modelHeads ? "model" : "app", ok: true, text: "", notes: [plan.map((h, i) => `${i + 1}. ${h}`).join("  ·  ") + (modelHeads ? "" : " (the model proposed none that held, so the app set these)")], errors: [] });
  const doc = { title: topic.charAt(0).toUpperCase() + topic.slice(1), topic, sources, facts, sections: [] };
  const used = new Set();
  for (const h of plan) {
    if (signal?.aborted) return { ok: false, why: "stopped" };
    const s = await addSection(doc, h, { complete, signal, used, onStep, onLive });
    void s;
  }
  if (!doc.sections.length) return { ok: false, why: "nothing held", ...essayOut(doc) };
  return { ok: true, ...essayOut(doc) };
}

/** Draft one section from the facts not yet used. Pushes a step; appends to doc.sections on success. */
export async function addSection(doc, heading, opts = {}) {
  const { complete, signal = null, onStep = () => {}, onLive = () => {} } = opts; let used = opts.used || null;
  used = used || new Set(doc.sections.flatMap((s) => s.sentences.flatMap((x) => x.refs)).map((r) => r - 1));
  const hw = new Set([...words(heading), ...(heading === "Overview" || !words(heading).length ? words(doc.topic) : [])]), tw = new Set(words(doc.topic));
  const rank = () => doc.facts.map((f, i) => ({ f, i, sc: overlap(words(f.text), hw) * 3 + overlap(words(f.text), tw) })).filter((x) => !used.has(x.i) && x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, opts.per || 4);
  let ranked = rank();
  onLive(`drafting “${heading}”`);
  if (ranked.length < 2) { await gatherMore(doc, `${doc.topic} ${heading}`, { signal, onLive, searchWeb: opts.searchWeb }); ranked = rank(); }
  if (ranked.length < 2) { onStep({ label: heading, by: "app", ok: false, text: "", notes: [], errors: [{ code: "no ground", msg: `the sources hold too little for “${heading}”, so the section was left out`, fix: "" }] }); return null; }
  const pick = ranked.map((x) => x.f); const notes = [];
  let kept = []; try { kept = await draftSection({ h: heading, topic: doc.topic, facts: doc.facts, pick, complete, signal, onNote: (n) => notes.push(n) }); } catch (e) { if (signal?.aborted) return null; notes.push("the model failed: " + String(e?.message || e)); }
  let by = "model";
  const nq = kept.filter((x) => x.quoted).length; if (nq) notes.push(`${nq} sentence${nq === 1 ? "" : "s"} quoted as written: the model\u2019s restatement did not hold`); if (nq === kept.length) by = "app";
  for (const r of ranked) used.add(r.i);
  const sec = { h: heading, sentences: kept }; doc.sections.push(sec);
  onStep({ label: heading, by, ok: true, text: "", notes: [`${kept.length} sentence${kept.length === 1 ? "" : "s"} set down`, ...notes.slice(0, 4)], errors: [], artifact: essayOut(doc) });
  return sec;
}

/** Read more of the web for a narrower query and add its checkable sentences to the essay's facts and sources. */
export async function gatherMore(doc, query, { signal = null, onLive = () => {}, searchWeb = web.searchWeb } = {}) {
  onLive(`reading more on “${query.slice(0, 50)}”`);
  _memo = _memo || web.makeMemo(); const before = doc.facts.length; const seen = new Set(doc.facts.map((f) => f.text.toLowerCase())); const qset = new Set(words(query));
  let found; try { found = await searchWeb(query, { effort: "deep", memo: _memo, onStep: (s) => { if (s.phase === "reading") onLive(`reading ${s.site || s.url}`); } }); } catch (e) { return 0; }
  if (signal?.aborted) return 0;
  for (const p of [...(found.pages || []), ...(found.passages || [])]) {
    const url = p.url; let si = doc.sources.findIndex((s) => s.url === url); if (si < 0) { doc.sources.push({ url, title: String(p.ref || url).split(" \u2014 ").pop() }); si = doc.sources.length - 1; }
    for (const s of sentencesOf(p.text).map((s) => ({ s, sc: overlap(words(s), qset) })).sort((a, b) => b.sc - a.sc).slice(0, 14).map((x) => x.s)) { const k = s.toLowerCase(); if (seen.has(k)) continue; seen.add(k); doc.facts.push({ text: s, src: si, sc: 0 }); }
  }
  return doc.facts.length - before;
}

/** "make it longer" / "1500 words" / "add 4 more sections": more sections on what the essay has not covered. */
export async function extendEssay(doc, ask, { complete, signal = null, onStep = () => {}, onLive = () => {} } = {}) {
  const have = doc.sections.length; const m = /add\s+(\d{1,2})\s+more/i.exec(ask);
  const target = m ? have + +m[1] : /(?:words?|sections|parts)/i.test(ask) ? lengthOf(ask) : have + 4;
  const need = Math.max(0, Math.min(16, target) - have);
  if (!need) { onStep({ label: "length", by: "app", ok: true, text: "", notes: [`already ${have} sections; ask for a larger number, or “make it longer”`], errors: [] }); return 0; }
  onLive("planning more sections");
  let heads = []; try { heads = parseHeads(await complete([{ role: "user", content: `An essay on "${doc.topic}" already has these sections: ${doc.sections.map((s) => s.h).join(", ")}. Give ${need} NEW short section headings (two to four words each) on aspects not yet covered. One per line. No numbers, no commentary.` }], { maxTokens: 20 + 12 * need, signal, stop: "none" }), need); } catch (e) { if (signal?.aborted) return 0; }
  const taken = () => doc.sections.map((s) => s.h.toLowerCase()).concat(heads.map((h) => h.toLowerCase()));
  heads = heads.filter((h) => !doc.sections.some((s) => s.h.toLowerCase() === h.toLowerCase()));
  for (const f of FALLBACK_HEADS) if (heads.length < need && !taken().includes(f.toLowerCase())) heads.push(f);
  onStep({ label: "outline", by: "model", ok: true, text: "", notes: [`adding ${heads.length}: ` + heads.join("  ·  ")], errors: [] });
  const used = new Set(doc.sections.flatMap((s) => s.sentences.flatMap((x) => x.refs)).map((r) => r - 1)); let added = 0;
  for (const h of heads) { if (signal?.aborted) break; if (await addSection(doc, h, { complete, signal, used, onStep, onLive })) added++; }
  return added;
}

/* ============================ EXTRACT ============================ */
async function fetchRaw(url, signal, bridge) {
  const wk = /^https?:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/([^?#]+)/i.exec(url);
  if (wk) { try { const r = await fetch(`https://${wk[1]}.wikipedia.org/w/api.php?action=parse&format=json&origin=*&prop=text|displaytitle&redirects=1&page=${encodeURIComponent(decodeURIComponent(wk[2]))}`, { signal, credentials: "omit" }); const j = await r.json(); const h = j?.parse?.text?.["*"]; if (h) return { raw: `<title>${j.parse.title} - Wikipedia</title>` + h, via: "Wikipedia's own API" }; } catch (e) { if (signal?.aborted) throw e; } }
  const tries = [["this machine", url]]; if (bridge) tries.push(["the bridge", `${bridge}/api/page?url=${encodeURIComponent(url)}`]);
  for (const [via, target] of tries) {
    try { const r = await fetch(target, { signal, credentials: "omit" }); if (!r.ok) continue; const t = (await r.text()).slice(0, 1500000); if (t.length > 200 && /<(html|body|table|ul|div|p)\b/i.test(t)) return { raw: t, via }; } catch (e) { if (signal?.aborted) throw e; }
  }
  return null;
}
const cell = (el) => one(el.textContent.replace(/\[(?:[a-z]|\d{1,3}|citation needed|note \d+)\]/gi, ""));
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const toCsv = (headers, rows) => [headers, ...rows].filter((r) => r && r.length).map((r) => r.map(csvCell).join(",")).join("\n");

export function parseHtml(raw, url) {
  const doc = new DOMParser().parseFromString(raw, "text/html");
  doc.querySelectorAll("script:not([type='application/ld+json']),style,noscript,svg,iframe").forEach((n) => n.remove());
  const abs = (h) => { try { return new URL(h, url).href; } catch { return null; } };
  const out = { title: one(doc.title) || url, url, meta: {}, tables: [], lists: [], links: [], jsonld: [] };
  for (const m of doc.querySelectorAll("meta[name=description],meta[property='og:description'],meta[property='og:title'],meta[property='og:site_name']")) out.meta[m.getAttribute("name") || m.getAttribute("property")] = one(m.getAttribute("content"));
  for (const s of doc.querySelectorAll("script[type='application/ld+json']")) { try { const j = JSON.parse(s.textContent); out.jsonld.push(...(Array.isArray(j) ? j : j["@graph"] || [j])); } catch {} }
  let heading = "";
  for (const el of doc.querySelectorAll("h1,h2,h3,h4,table,ul,ol")) {
    const tag = el.tagName.toLowerCase();
    if (/^h\d$/.test(tag)) { heading = cell(el).slice(0, 100); continue; }
    if (el.closest("nav,header,footer,aside,[role=navigation]") || (tag !== "table" && el.parentElement?.closest("li,table"))) continue;
    if (tag === "table") {
      const trs = [...el.querySelectorAll("tr")].filter((tr) => !tr.closest("table") || tr.closest("table") === el);
      const rows = trs.map((tr) => [...tr.children].filter((c) => /^t[dh]$/i.test(c.tagName)).map(cell)); if (rows.length < 2) continue;
      const hdrRow = trs[0] && [...trs[0].children].every((c) => c.tagName === "TH") ? 0 : -1;
      const w = Math.max(...rows.map((r) => r.length)); const headers = hdrRow === 0 ? rows[0] : Array.from({ length: w }, (_, i) => `column ${i + 1}`);
      out.tables.push({ heading: one(el.querySelector("caption")?.textContent) || heading, headers, rows: rows.slice(hdrRow === 0 ? 1 : 0).filter((r) => r.some(Boolean)).slice(0, 500) });
    } else {
      const items = [...el.children].filter((c) => c.tagName === "LI").map(cell).filter(Boolean); if (items.length < 3) continue;
      out.lists.push({ heading, ordered: tag === "ol", items: items.slice(0, 300) });
    }
  }
  const seen = new Set();
  for (const a of doc.querySelectorAll("a[href]")) { const text = cell(a), href = abs(a.getAttribute("href")); if (!href || !/^https?:/.test(href) || text.length < 3 || text.length > 120 || seen.has(href)) continue; seen.add(href); out.links.push({ text, href }); if (out.links.length >= 300) break; }
  return out;
}
/** What is left when only the page's TEXT could be read (no markup): bullet / numbered lines and "key: value" lines. */
export function parseText(text, url, title) {
  const lines = String(text).split("\n").map(one).filter(Boolean);
  const items = lines.filter((l) => /^([-*\u2022]|\d+[.)])\s+\S/.test(l)).map((l) => l.replace(/^([-*\u2022]|\d+[.)])\s+/, ""));
  const kv = lines.map((l) => /^([A-Z][\w &/-]{1,30}):\s+(.{1,200})$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2]]);
  return { title: title || url, url, meta: {}, tables: kv.length >= 3 ? [{ heading: "Key: value lines", headers: ["key", "value"], rows: kv.slice(0, 300) }] : [], lists: items.length >= 3 ? [{ heading: "Listed lines", ordered: false, items: items.slice(0, 300) }] : [], links: [], jsonld: [], textOnly: true, paragraphs: lines.filter((l) => l.length > 80).slice(0, 40) };
}

function primaryOf(d, ask) {
  const q = new Set(words(String(ask).replace(URL_RE, " "))); const cands = []; const wantT = /\btables?\b/i.test(ask), wantL = /\blists?\b/i.test(ask);
  d.tables.forEach((t, i) => cands.push({ kind: "table", i, sc: overlap(words([t.heading, ...t.headers].join(" ")), q) * 20 + Math.min(40, t.rows.length * t.headers.length / 4) + (wantT ? 30 : 0) }));
  d.lists.forEach((l, i) => cands.push({ kind: "list", i, sc: overlap(words(l.heading + " " + l.items.slice(0, 5).join(" ")), q) * 20 + Math.min(25, l.items.length / 2) + (wantL ? 30 : 0) }));
  if (d.links.length >= 5) cands.push({ kind: "links", i: 0, sc: (/\blinks?|urls?|headlines?\b/i.test(ask) ? 30 : 0) + 3 });
  return cands.sort((a, b) => b.sc - a.sc)[0] || null;
}
function tableHtml(headers, rows, cap = 60) {
  return `<div class=tw><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.slice(0, cap).map((r) => `<tr>${headers.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${rows.length > cap ? `<div class=more>${rows.length - cap} more rows in the download</div>` : ""}`;
}
function renderExtract(d, prim, via) {
  const blocks = [];
  d.tables.forEach((t, i) => blocks.push({ main: prim?.kind === "table" && prim.i === i, h: `${t.heading || "Table " + (i + 1)} <small>${t.rows.length} rows × ${t.headers.length}</small>`, b: tableHtml(t.headers, t.rows) }));
  d.lists.forEach((l, i) => blocks.push({ main: prim?.kind === "list" && prim.i === i, h: `${l.heading || "List " + (i + 1)} <small>${l.items.length} items</small>`, b: `<ul>${l.items.slice(0, 60).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` }));
  if (d.links.length) blocks.push({ main: prim?.kind === "links", h: `Links <small>${d.links.length}</small>`, b: tableHtml(["text", "href"], d.links.map((l) => [l.text, l.href]), 40) });
  if (d.jsonld.length) blocks.push({ main: false, h: `Structured data the page declares <small>${d.jsonld.length}</small>`, b: `<pre>${esc(JSON.stringify(d.jsonld, null, 2).slice(0, 4000))}</pre>` });
  if (d.paragraphs?.length && !blocks.length) blocks.push({ main: false, h: "Text", b: d.paragraphs.slice(0, 10).map((p) => `<p>${esc(p)}</p>`).join("") });
  blocks.sort((a, b) => b.main - a.main);
  return `<!doctype html><meta charset=utf-8><title>${esc(d.title)}</title><style>body{font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px;color:#1b1b1f}h1{font-size:20px;margin:0 0 4px}.s{color:#666;font-size:13px;margin-bottom:18px;overflow-wrap:anywhere}h2{font-size:15px;margin:22px 0 8px}h2 small{font-weight:400;color:#666;margin-left:6px}.main h2:before{content:"extracted \u2192 ";color:#0d7a70;font-weight:700}.tw{overflow:auto;border:1px solid #ddd;border-radius:8px;max-height:420px}table{border-collapse:collapse;width:100%}th,td{padding:6px 10px;text-align:left;border-bottom:1px solid #eee;vertical-align:top}th{background:#f4f4f6;position:sticky;top:0}ul{margin:0;padding-left:20px}pre{background:#f4f4f6;padding:12px;border-radius:8px;overflow:auto;font-size:12px}.more{font-size:12px;color:#666;margin-top:4px}</style><h1>${esc(d.title)}</h1><div class=s>${esc(d.url)} · read by ${esc(via)}${d.textOnly ? " · page text only (no markup reachable), so only listed and key: value lines could be found" : ""}</div>${blocks.map((x) => `<div class="${x.main ? "main" : ""}"><h2>${x.h}</h2>${x.b}</div>`).join("") || "<p>Nothing structured was found on this page.</p>"}`;
}

/** runExtract(ask, { signal, onStep, onLive, bridge }) → { ok, html, files, why } */
export async function runExtract(ask, { signal = null, onStep = () => {}, onLive = () => {}, bridge = null } = {}) {
  const url = urlOf(ask); if (!url) return { ok: false, why: "no URL in the ask" };
  onLive(`reading ${new URL(url).hostname}`);
  let d = null, via = "";
  const got = await fetchRaw(url, signal, bridge || web.getBridge?.());
  if (got) { d = parseHtml(got.raw, url); via = got.via; }
  else {
    const rd = await web.readText(url, { direct: false });
    if (!rd.ok) { onStep({ label: "read the page", by: "app", ok: false, text: "", notes: [], errors: [{ code: "unreachable", msg: `${url} could not be read (${rd.error || "refused"}). Sites that block other pages need the extension or the bridge`, fix: "" }] }); return { ok: false, why: "unreachable" }; }
    d = parseText(rd.text, url, rd.title); via = rd.via || "a text reader";
  }
  const prim = primaryOf(d, ask);
  onStep({ label: "read the page", by: "app", ok: true, text: "", notes: [`${d.title} · read by ${via}`, `found ${d.tables.length} table${d.tables.length === 1 ? "" : "s"}, ${d.lists.length} list${d.lists.length === 1 ? "" : "s"}, ${d.links.length} links, ${d.jsonld.length} structured-data block${d.jsonld.length === 1 ? "" : "s"}`], errors: [] });
  if (!prim && !d.jsonld.length && !d.paragraphs?.length) { onStep({ label: "parse", by: "app", ok: false, text: "", notes: [], errors: [{ code: "nothing structured", msg: "no table, list or links of useful size on this page", fix: "" }] }); return { ok: false, why: "nothing structured" }; }
  const files = []; let what = "";
  if (prim?.kind === "table") { const t = d.tables[prim.i]; files.push({ name: "extracted.csv", mime: "text/csv", text: toCsv(t.headers, t.rows) }); what = `table “${t.heading || prim.i + 1}” (${t.rows.length} rows)`; }
  else if (prim?.kind === "list") { const l = d.lists[prim.i]; files.push({ name: "extracted.csv", mime: "text/csv", text: toCsv(["item"], l.items.map((x) => [x])) }); what = `list “${l.heading || prim.i + 1}” (${l.items.length} items)`; }
  else if (prim?.kind === "links") { files.push({ name: "extracted.csv", mime: "text/csv", text: toCsv(["text", "href"], d.links.map((l) => [l.text, l.href])) }); what = `the page's links (${d.links.length})`; }
  files.push({ name: "page.json", mime: "application/json", text: JSON.stringify(d, null, 2) });
  const html = renderExtract(d, prim, via);
  onStep({ label: "parse", by: "app", ok: true, text: "", notes: [prim ? `main result: ${what}, chosen by how well it matches your words and its size` : "only structured data was found", "parsed by the app; no model was used, so nothing was invented"], errors: [], artifact: { html, files } });
  return { ok: true, html, files };
}

/** A literal replace over an artifact's text (not its tags), for follow-ups like change “a” to “b”. */
export function replaceInArtifact(art, from, to) {
  const rx = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); let n = 0;
  const html = String(art.html).split(/(<[^>]+>|<style[\s\S]*?<\/style>)/i).map((p, i) => (i % 2 ? p : p.replace(rx, () => (n++, to)))).join("");
  const files = (art.files || []).map((f) => ({ ...f, text: f.text.replace(rx, () => (n++, to)) }));
  return n ? { ...art, html, files, doc: art.doc ? JSON.parse(JSON.stringify(art.doc).replace(rx, to.replace(/"/g, '\\"'))) : art.doc } : null;
}
export { renderEssay, essayOut };
