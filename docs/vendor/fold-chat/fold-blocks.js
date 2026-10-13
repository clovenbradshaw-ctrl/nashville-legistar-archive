// fold-blocks.js — the block catalog, laid on EO's 27 coherent (terrain × stance) cells, the theme tokens, and the renderer.
// A block is a pre-built, tested part. The model never writes HTML: it selects blocks and sets their properties in EOT
// (fold-blocks-kernel.js validates), and this file draws the result. Pure: no DOM, no IO. render() returns a whole HTML document.

export const GRAINS = Object.freeze(["Ground", "Figure", "Pattern"]);
export const TERRAINS = Object.freeze({
  Void: { domain: "Existence", grain: "Ground" }, Entity: { domain: "Existence", grain: "Figure" }, Kind: { domain: "Existence", grain: "Pattern" },
  Field: { domain: "Structure", grain: "Ground" }, Link: { domain: "Structure", grain: "Figure" }, Network: { domain: "Structure", grain: "Pattern" },
  Atmosphere: { domain: "Significance", grain: "Ground" }, Lens: { domain: "Significance", grain: "Figure" }, Paradigm: { domain: "Significance", grain: "Pattern" },
});
export const STANCES = Object.freeze({
  Clearing: { mode: "Differentiate", grain: "Ground" }, Dissecting: { mode: "Differentiate", grain: "Figure" }, Unraveling: { mode: "Differentiate", grain: "Pattern" },
  Tending: { mode: "Relate", grain: "Ground" }, Binding: { mode: "Relate", grain: "Figure" }, Tracing: { mode: "Relate", grain: "Pattern" },
  Cultivating: { mode: "Generate", grain: "Ground" }, Making: { mode: "Generate", grain: "Figure" }, Composing: { mode: "Generate", grain: "Pattern" },
});
export const OPS = Object.freeze(["NUL", "SIG", "INS", "SEG", "CON", "SYN", "DEF", "EVA", "REC"]);
// SYN at Ground: synthesis from pure ambient conditions. Empty in every language tested; no block may live there.
export const DESERT = Object.freeze({ terrain: "Field", stance: "Cultivating", op: "SYN", why: "Nothing builds a layout out of a mood. Set theme tokens (Atmosphere) or draw boundaries (Field) instead." });

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------------- colour ---------------- */
export function isColor(v) { return typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }
function rgb(hex) { let h = hex.trim().slice(1); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }
function lum(hex) { const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export function contrastRatio(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
export function onColor(bg) { return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#141416") ? "#ffffff" : "#141416"; }

/* ---------------- the theme: Atmosphere × Cultivating, the only place look is set ---------------- */
export const THEME_DEFAULTS = Object.freeze({ accent: "#0d7a70", ink: "#17171a", surface: "#ffffff", font: "sans", radius: "soft", density: "cozy" });
const FONTS = { sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif', mono: "ui-monospace, SFMono-Regular, Menlo, monospace", rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, sans-serif' };
const RADII = { sharp: "3px", soft: "10px", round: "22px" };
const DENSITY = { compact: 0.75, cozy: 1, airy: 1.35 };
export function themeVars(t = {}) {
  const th = { ...THEME_DEFAULTS, ...Object.fromEntries(Object.entries(t).filter(([, v]) => v != null && v !== "")) };
  const mix = (a, p, b) => `color-mix(in srgb, ${a} ${p}%, ${b})`;
  return {
    "--accent": th.accent, "--on-accent": onColor(th.accent), "--ink": th.ink, "--surface": th.surface,
    "--muted": mix(th.ink, 68, th.surface), "--line": mix(th.ink, 13, th.surface), "--field": mix(th.ink, 45, th.surface), "--tint": mix(th.accent, 8, th.surface),
    "--font": FONTS[th.font] || FONTS.sans, "--r": RADII[th.radius] || RADII.soft, "--r-pill": th.radius === "sharp" ? "4px" : "999px", "--u": `${8 * (DENSITY[th.density] || 1)}px`,
  };
}

/* ---------------- the expression evaluator: the APP computes, the model only names inputs ----------------
   Self-contained (no outer references) so render() can ship it into the artifact as source. */
export function expr(src) {
  const FN = { min: Math.min, max: Math.max, floor: Math.floor, ceil: Math.ceil, abs: Math.abs, pow: Math.pow, sqrt: Math.sqrt, round: function (x, d) { var k = Math.pow(10, d || 0); return Math.round(x * k) / k; } };
  var s = String(src == null ? "" : src), toks = [], i = 0;
  while (i < s.length) {
    var c = s[i], rest = s.slice(i);
    if (/\s/.test(c)) { i++; continue; }
    var num = /^(\d+\.?\d*|\.\d+)/.exec(rest); if (num) { toks.push({ t: "n", v: parseFloat(num[1]) }); i += num[1].length; continue; }
    var id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest); if (id) { toks.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    if ("+-*/%^(),".indexOf(c) >= 0) { toks.push({ t: c }); i++; continue; }
    return { ok: false, error: "unexpected '" + c + "'", names: [] };
  }
  var p = 0, names = [];
  function eat(t) { if (toks[p] && toks[p].t === t) { p++; return true; } return false; }
  function primary() {
    var k = toks[p++]; if (!k) throw new Error("the expression ends too early");
    if (k.t === "n") return { k: "n", v: k.v };
    if (k.t === "id") {
      if (eat("(")) { if (!FN[k.v]) throw new Error("unknown function " + k.v); var args = []; if (!eat(")")) { do args.push(add()); while (eat(",")); if (!eat(")")) throw new Error("missing )"); } return { k: "f", f: k.v, args: args }; }
      if (names.indexOf(k.v) < 0) names.push(k.v); return { k: "id", v: k.v };
    }
    if (k.t === "(") { var e = add(); if (!eat(")")) throw new Error("missing )"); return e; }
    throw new Error("unexpected '" + k.t + "'");
  }
  function power() { var b = primary(); if (eat("^")) return { k: "op", op: "^", a: b, b: unary() }; return b; }
  function unary() { if (eat("-")) return { k: "neg", a: unary() }; if (eat("+")) return unary(); return power(); }
  function mul() { var a = unary(); for (;;) { var t = toks[p] && toks[p].t; if (t === "*" || t === "/" || t === "%") { p++; a = { k: "op", op: t, a: a, b: unary() }; } else return a; } }
  function add() { var a = mul(); for (;;) { var t = toks[p] && toks[p].t; if (t === "+" || t === "-") { p++; a = { k: "op", op: t, a: a, b: mul() }; } else return a; } }
  var ast;
  try { if (!toks.length) throw new Error("empty expression"); ast = add(); if (p < toks.length) throw new Error("unexpected '" + (toks[p].v != null ? toks[p].v : toks[p].t) + "'"); }
  catch (e) { return { ok: false, error: e.message, names: names }; }
  function ev(n, v) {
    if (n.k === "n") return n.v;
    if (n.k === "id") return Number(v[n.v]);
    if (n.k === "f") return FN[n.f].apply(null, n.args.map(function (a) { return ev(a, v); }));
    if (n.k === "neg") return -ev(n.a, v);
    var a = ev(n.a, v), b = ev(n.b, v);
    return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : n.op === "/" ? a / b : n.op === "%" ? a % b : Math.pow(a, b);
  }
  return { ok: true, names: names, run: function (vars) { return ev(ast, vars || {}); } };
}
/* ---------------- there is no formula catalog ----------------
   A computation is the model's OWN expression (.expr), written in the input names.
   The kernel checks its shape (a real expression over named inputs) but not its
   meaning; the app evaluates it in the sandbox. Nothing is selected from a menu. */

export function formatValue(x, format, { currency = "£", unit = "" } = {}) {
  if (typeof x !== "number" || !isFinite(x)) return "—";
  const n = (d) => x.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  if (format === "money") return currency + x.toLocaleString("en-GB", { maximumFractionDigits: Math.abs(x) < 100 ? 2 : 0, minimumFractionDigits: Math.abs(x) < 100 ? 2 : 0 });
  if (format === "percent") return n(1) + "%";
  return n(2) + (unit ? " " + unit : "");
}

/* ---------------- the catalog ----------------
   props: name → type. Types: text · number · list · room · field · fields · blocks · expr · name · color · choice:a|b. A trailing ? = optional. */
const cite = (keys) => (keys || []).map((k) => `<a class="cite" href="#src-${esc(k)}">${esc(k)}</a>`).join("");
const rowsOf = (ctx, room) => (ctx.rooms[room]?.rows || []);
const slot = (label, ratio = "") => `<div class="slot ${esc(ratio)}" role="img" aria-label="${esc(label)}">${esc(label)}</div>`;
function fieldType(label) {
  const l = label.toLowerCase();
  if (/e-?mail/.test(l)) return "email"; if (/phone|tel/.test(l)) return "tel"; if (/date|day|when/.test(l)) return "date"; if (/time/.test(l)) return "time";
  if (/message|note|comment|details|about|question/.test(l)) return "textarea"; if (/number|qty|quantity|guests|people|age|count/.test(l)) return "number"; return "text";
}
function block(cell, ops, about, props, render, extra = {}) {
  return Object.freeze({ cell: Object.freeze(cell), contract: Object.freeze({ ops: Object.freeze(ops), terrains: Object.freeze([cell[0]]), stances: Object.freeze([cell[1]]) }), about, props: Object.freeze(props), render, ...extra });
}
export const BLOCKS = Object.freeze({
  theme: block(["Atmosphere", "Cultivating"], ["DEF"], "the look: colour, type, corners, spacing",
    { accent: "color?", ink: "color?", surface: "color?", font: "choice:sans|serif|mono|rounded?", radius: "choice:sharp|soft|round?", density: "choice:compact|cozy|airy?" }, () => "", { ambient: true }),
  section: block(["Field", "Clearing"], ["SEG"], "a band of the page that arranges other blocks",
    { title: "text?", layout: "choice:stack|split|grid?", cols: "number?", tone: "choice:plain|tint|ink?", children: "blocks" },
    (p, ctx) => `<section class="b-section tone-${esc(p.tone || "plain")}"><div class="wrap">${p.title ? `<h2 class="blk-h">${esc(p.title)}</h2>` : ""}<div class="lay-${esc(p.layout || "stack")}" style="--cols:${Number(p.cols) || 3}">${(p.children || []).map(ctx.child).join("")}</div></div></section>`, { container: true }),
  footer: block(["Field", "Tending"], ["NUL"], "the quiet strip that closes a page", { text: "text" }, (p) => `<footer class="b-footer">${esc(p.text)}</footer>`),
  empty: block(["Void", "Clearing"], ["NUL"], "an honest empty state or a marked gap", { text: "text" }, (p) => `<div class="b-empty">${esc(p.text)}</div>`),
  slot: block(["Void", "Tending"], ["NUL"], "a place held for an image someone will supply", { label: "text", ratio: "choice:wide|square|tall?" }, (p) => slot(p.label, p.ratio)),
  hero: block(["Entity", "Binding"], ["NUL"], "the opening statement of a page", { title: "text", sub: "text?", cta: "text?", image: "text?" },
    (p) => `<header class="b-hero"><div>${`<h1>${esc(p.title)}</h1>`}${p.sub ? `<p>${esc(p.sub)}</p>` : ""}${p.cta ? `<a class="btn solid" href="#book">${esc(p.cta)}</a>` : ""}</div>${p.image ? slot(p.image, "wide") : ""}</header>`),
  card: block(["Entity", "Binding"], ["NUL"], "one thing, named, with a line about it", { title: "text", text: "text?", meta: "text?" },
    (p) => `<article class="b-card"><h3>${esc(p.title)}</h3>${p.text ? `<p>${esc(p.text)}</p>` : ""}${p.meta ? `<span class="meta">${esc(p.meta)}</span>` : ""}</article>`),
  form: block(["Entity", "Making"], ["INS"], "a form that creates a record", { title: "text?", fields: "list", submit: "text?", done: "text?", room: "room?" },
    (p) => `<form class="b-form" id="book" data-done="${esc(p.done || "Thanks, that's in. (Preview: nothing was sent.)")}" novalidate>${p.title ? `<h2 class="blk-h">${esc(p.title)}</h2>` : ""}${(p.fields || []).map((f, i) => { const t = fieldType(f), id = "f" + i; return `<label for="${id}">${esc(f)}${t === "textarea" ? `<textarea id="${id}" rows="4"></textarea>` : `<input id="${id}" type="${t}" required>`}</label>`; }).join("")}<button class="btn solid" type="submit">${esc(p.submit || "Send")}</button><div class="done" hidden role="status"></div></form>`),
  list: block(["Entity", "Dissecting"], ["NUL", "SEG"], "the records of a room, sorted", { room: "room", title: "field", sub: "field?", sort: "field?" },
    (p, ctx) => { const rows = [...rowsOf(ctx, p.room)]; if (p.sort) rows.sort((a, b) => String(a[p.sort]).localeCompare(String(b[p.sort]), undefined, { numeric: true })); return `<ul class="b-list">${rows.map((r) => `<li><b>${esc(r[p.title])}</b>${p.sub ? `<span>${esc(r[p.sub])}</span>` : ""}</li>`).join("")}</ul>`; }),
  nav: block(["Link", "Binding"], ["NUL", "CON"], "the name and the ways around", { brand: "text", items: "list?" },
    (p) => `<nav class="b-nav"><b>${esc(p.brand)}</b><div class="items">${(p.items || []).map((x) => `<a href="#">${esc(x)}</a>`).join("")}</div></nav>`),
  button: block(["Link", "Binding"], ["NUL", "CON"], "one action, as a link", { label: "text", href: "text?", style: "choice:solid|outline?" },
    (p) => `<a class="btn ${esc(p.style || "solid")}" href="${esc(/^(https?:|#|\/)/.test(p.href || "") ? p.href : "#")}">${esc(p.label)}</a>`),
  sources: block(["Link", "Dissecting"], ["NUL", "CON"], "the references a document cites, by key", { room: "room", title: "text?" },
    (p, ctx) => `<section class="b-sources"><h2 class="blk-h">${esc(p.title || "Sources")}</h2><ol>${rowsOf(ctx, p.room).map((r) => { const v = Object.values(r); return `<li id="src-${esc(v[0])}"><b>${esc(v[0])}</b> ${esc(v.slice(1).join(" · "))}</li>`; }).join("")}</ol></section>`, { sources: true }),
  result: block(["Lens", "Dissecting"], ["EVA"], "a value the app computes from the inputs", { label: "text", expr: "expr?", format: "choice:number|money|percent?", unit: "text?", currency: "text?" },
    (p) => `<div class="b-result"><span>${esc(p.label)}</span><output data-expr="${esc(p.expr)}" data-format="${esc(p.format || "number")}" data-unit="${esc(p.unit || "")}" data-currency="${esc(p.currency || "£")}">—</output></div>`),
  quote: block(["Lens", "Binding"], ["NUL", "CON"], "someone's words, held to their source", { text: "text", source: "text" },
    (p) => `<figure class="b-quote"><blockquote>${esc(p.text)}</blockquote><figcaption>${esc(p.source)}</figcaption></figure>`),
  text: block(["Lens", "Making"], ["DEF"], "a paragraph that asserts something; may cite sources", { text: "text", cite: "list?" },
    (p) => `<p class="b-text">${esc(p.text)}${cite(p.cite)}</p>`),
  input: block(["Lens", "Making"], ["DEF"], "one value a person sets", { name: "name", label: "text", kind: "choice:number|range|choice|toggle", value: "text?", min: "number?", max: "number?", step: "number?", options: "list?", unit: "text?" },
    (p) => {
      const lab = `<span class="lab">${esc(p.label)}${p.kind === "range" ? ` <b data-show="${esc(p.name)}"></b>${p.unit ? " " + esc(p.unit) : ""}` : ""}</span>`;
      const mm = `${p.min != null ? ` min="${p.min}"` : ""}${p.max != null ? ` max="${p.max}"` : ""}${p.step != null ? ` step="${p.step}"` : ""}`;
      if (p.kind === "choice") { const opts = p.options || []; const on = p.value != null ? String(p.value) : opts[0]; return `<div class="b-input" role="group" aria-label="${esc(p.label)}" data-in="${esc(p.name)}" data-kind="choice">${lab}<div class="seg">${opts.map((o) => `<button type="button" data-v="${esc(parseFloat(o))}" aria-pressed="${String(o) === String(on) || parseFloat(o) === parseFloat(on)}">${esc(o)}${p.unit ? " " + esc(p.unit) : ""}</button>`).join("")}</div></div>`; }
      if (p.kind === "toggle") return `<label class="b-input tog">${lab}<input type="checkbox" data-in="${esc(p.name)}" data-kind="toggle"${/^(1|true|yes|on)$/i.test(String(p.value ?? "")) ? " checked" : ""}></label>`;
      return `<label class="b-input">${lab}<input type="${p.kind === "range" ? "range" : "number"}" inputmode="decimal" data-in="${esc(p.name)}" data-kind="${esc(p.kind)}" value="${esc(p.value ?? p.min ?? 0)}"${mm}>${p.kind === "number" && p.unit ? `<i>${esc(p.unit)}</i>` : ""}</label>`;
    }, { input: true }),
  table: block(["Kind", "Unraveling"], ["NUL", "SEG"], "a room laid out by its fields", { room: "room", columns: "fields?", title: "text?" },
    (p, ctx) => { const room = ctx.rooms[p.room]; const cols = p.columns?.length ? p.columns : Object.keys(room?.schema || {}); return `<div class="b-table">${p.title ? `<h2 class="blk-h">${esc(p.title)}</h2>` : ""}<table><thead><tr>${cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead><tbody>${rowsOf(ctx, p.room).map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }),
  stat: block(["Kind", "Tracing"], ["NUL"], "one figure and what it measures", { label: "text", value: "text" }, (p) => `<div class="b-stat"><b>${esc(p.value)}</b><span>${esc(p.label)}</span></div>`),
  chart: block(["Kind", "Tracing"], ["NUL"], "bars for one numeric field across a room", { room: "room", x: "field", y: "field", title: "text?" },
    (p, ctx) => { const rows = rowsOf(ctx, p.room); const vals = rows.map((r) => parseFloat(String(r[p.y]).replace(/[^\d.-]/g, "")) || 0); const max = Math.max(1, ...vals); return `<figure class="b-chart">${p.title ? `<figcaption>${esc(p.title)}</figcaption>` : ""}<div class="bars">${rows.map((r, i) => `<div class="bar"><span class="v" style="height:${Math.round((vals[i] / max) * 100)}%"></span><b>${esc(r[p.y])}</b><span>${esc(r[p.x])}</span></div>`).join("")}</div></figure>`; }),
  cards: block(["Kind", "Composing"], ["NUL"], "one card per record of a room (prices, people, products)", { room: "room", title: "field", sub: "field?", meta: "field?", cta: "text?", heading: "text?" },
    (p, ctx) => `<div class="b-cards">${p.heading ? `<h2 class="blk-h">${esc(p.heading)}</h2>` : ""}<div class="grid">${rowsOf(ctx, p.room).map((r) => `<article class="b-card"><h3>${esc(r[p.title])}</h3>${p.sub ? `<span class="sub">${esc(r[p.sub])}</span>` : ""}${p.meta ? `<span class="meta">${esc(r[p.meta])}</span>` : ""}${p.cta ? `<a class="btn outline" href="#book">${esc(p.cta)}</a>` : ""}</article>`).join("")}</div></div>`),
  steps: block(["Network", "Tracing"], ["NUL"], "an ordered path, step by step", { items: "list", title: "text?" },
    (p) => `<div class="b-steps">${p.title ? `<h2 class="blk-h">${esc(p.title)}</h2>` : ""}<ol>${(p.items || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>`),
  faq: block(["Paradigm", "Unraveling"], ["NUL"], "the questions people bring, opened one at a time", { room: "room", q: "field", a: "field", title: "text?" },
    (p, ctx) => `<div class="b-faq">${p.title ? `<h2 class="blk-h">${esc(p.title)}</h2>` : ""}${rowsOf(ctx, p.room).map((r) => `<details><summary>${esc(r[p.q])}</summary><p>${esc(r[p.a])}</p></details>`).join("")}</div>`),
  heading: block(["Paradigm", "Composing"], ["DEF"], "a title that structures what follows", { text: "text", level: "choice:1|2|3?" },
    (p) => { const l = Number(p.level) || 2; return `<h${l} class="b-h h${l}">${esc(p.text)}</h${l}>`; }),
});

// The 27 coherent cells: a terrain and a stance of the same grain. Each holds its blocks, is a known gap, or is the desert.
export const CELLS = Object.freeze(GRAINS.flatMap((g) => Object.keys(TERRAINS).filter((t) => TERRAINS[t].grain === g).flatMap((t) =>
  Object.keys(STANCES).filter((s) => STANCES[s].grain === g).map((s) => Object.freeze({
    grain: g, terrain: t, stance: s, desert: t === DESERT.terrain && s === DESERT.stance,
    blocks: Object.freeze(Object.keys(BLOCKS).filter((b) => BLOCKS[b].cell[0] === t && BLOCKS[b].cell[1] === s)),
  })))));
export const KINDS = Object.freeze(["website", "widget", "document"]);

/* ---------------- the renderer ---------------- */
const CSS = `*{box-sizing:border-box}html,body{margin:0}body{font:16px/1.6 var(--font);color:var(--ink);background:var(--surface);-webkit-font-smoothing:antialiased}
a{color:var(--accent)}h1,h2,h3{line-height:1.15;margin:0;text-wrap:balance}p{margin:0;text-wrap:pretty}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap{max-width:1040px;margin:0 auto;padding:0 calc(var(--u)*3)}.pad{padding-top:calc(var(--u)*5);padding-bottom:calc(var(--u)*5)}
.blk-h{font-size:28px;margin-bottom:calc(var(--u)*3)}
.b-nav{display:flex;align-items:center;flex-wrap:wrap;gap:calc(var(--u)*3);padding:calc(var(--u)*2.5) 0}.b-nav b{font-size:18px}.b-nav .items{display:flex;flex-wrap:wrap;gap:calc(var(--u)*2.5);margin-left:auto}.b-nav a{color:var(--ink);text-decoration:none;font-size:15px}.b-nav a:hover{color:var(--accent)}
.b-hero{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:calc(var(--u)*5);align-items:center;padding:calc(var(--u)*7) 0 calc(var(--u)*5)}
.b-hero h1{font-size:clamp(34px,5vw,54px);letter-spacing:-.01em}.b-hero p{font-size:19px;color:var(--muted);margin-top:calc(var(--u)*1.5);max-width:32em}.b-hero .btn{margin-top:calc(var(--u)*3)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 20px;border-radius:var(--r-pill);font:600 15px/1 var(--font);text-decoration:none;border:1.5px solid var(--accent);cursor:pointer;white-space:nowrap}
.btn.solid{background:var(--accent);color:var(--on-accent)}.btn.outline{background:transparent;color:var(--accent)}
.slot{border-radius:var(--r);background:repeating-linear-gradient(135deg,var(--tint) 0 10px,var(--surface) 10px 20px);border:1px solid var(--line);display:grid;place-items:center;color:var(--muted);font:13px/1.4 ui-monospace,Menlo,monospace;aspect-ratio:4/3;padding:16px;text-align:center}
.slot.wide{aspect-ratio:16/10}.slot.tall{aspect-ratio:3/4}.slot.square{aspect-ratio:1}
.b-section{padding:calc(var(--u)*6) 0}.b-section.tone-tint{background:var(--tint)}.b-section.tone-ink{background:var(--ink);color:var(--surface)}
.lay-stack{display:flex;flex-direction:column;gap:calc(var(--u)*3)}.lay-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:calc(var(--u)*4);align-items:start}
.lay-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,calc(960px / var(--cols) - 24px)),1fr));gap:calc(var(--u)*2)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:calc(var(--u)*2)}
.b-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:calc(var(--u)*2.5);display:flex;flex-direction:column;gap:6px;color:var(--ink)}
.b-card h3{font-size:18px}.b-card .sub{font-size:21px;font-weight:700;color:var(--accent)}.b-card .meta,.b-card p{font-size:15px;color:var(--muted)}.b-card .btn{margin-top:auto;align-self:flex-start;min-height:40px;margin-top:10px}
.b-form{display:flex;flex-direction:column;gap:calc(var(--u)*2);max-width:540px}.b-form label{display:flex;flex-direction:column;gap:6px;font-size:15px;font-weight:600}
.b-form input,.b-form textarea{font:inherit;font-weight:400;padding:10px 12px;border:1px solid var(--field);border-radius:calc(var(--r)*.7);background:var(--surface);color:var(--ink);min-height:44px}
.b-form input[aria-invalid=true]{border-color:#c62828}.b-form .btn{align-self:flex-start}.b-form .done{padding:12px 14px;border-radius:var(--r);background:var(--tint)}
.b-footer{padding:calc(var(--u)*4) 0;color:var(--muted);font-size:14px;border-top:1px solid var(--line);margin-top:calc(var(--u)*4)}
.b-empty{padding:calc(var(--u)*3);border:1px dashed var(--field);border-radius:var(--r);color:var(--muted);text-align:center}
.b-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}.b-list li{display:flex;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--line)}.b-list span{color:var(--muted)}
.b-table{overflow-x:auto}.b-table table{border-collapse:collapse;width:100%;font-size:15px}.b-table th,.b-table td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line)}.b-table th{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.b-stat{display:flex;flex-direction:column;gap:2px}.b-stat b{font-size:40px;line-height:1.1;color:var(--accent);font-variant-numeric:tabular-nums}.b-stat span{color:var(--muted)}
.b-chart{margin:0}.b-chart figcaption{font-weight:600;margin-bottom:12px}.b-chart .bars{display:flex;align-items:flex-end;gap:12px;height:220px}.b-chart .bar{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:4px;height:100%;font-size:13px}.b-chart .v{width:100%;background:var(--accent);border-radius:calc(var(--r)*.5) calc(var(--r)*.5) 0 0;min-height:2px}.b-chart .bar span:last-child{color:var(--muted)}
.b-steps ol{margin:0;padding:0;list-style:none;counter-reset:s;display:flex;flex-direction:column;gap:12px}.b-steps li{counter-increment:s;display:flex;gap:14px;align-items:baseline}.b-steps li::before{content:counter(s);flex:none;width:30px;height:30px;border-radius:50%;background:var(--tint);color:var(--accent);font-weight:700;display:grid;place-items:center}
.b-faq details{border-bottom:1px solid var(--line);padding:12px 0}.b-faq summary{cursor:pointer;font-weight:600}.b-faq details p{margin-top:8px;color:var(--muted)}
.b-quote{margin:0;padding-left:18px;border-left:3px solid var(--accent)}.b-quote blockquote{margin:0;font-size:19px;line-height:1.55}.b-quote figcaption{margin-top:8px;color:var(--muted);font-size:14px}
.b-text{font-size:17px;line-height:1.7}.cite{font:600 11px/1 var(--font);color:var(--accent);background:var(--tint);border-radius:4px;padding:2px 5px;margin-left:4px;vertical-align:2px;text-decoration:none}
.b-h{margin-top:.6em}.b-h.h1{font-size:36px}.b-h.h2{font-size:26px}.b-h.h3{font-size:20px}
.b-sources ol{padding-left:0;list-style:none;display:flex;flex-direction:column;gap:8px;font-size:15px}.b-sources li:target{background:var(--tint)}
.doc{max-width:720px;margin:0 auto;padding:calc(var(--u)*7) calc(var(--u)*3);display:flex;flex-direction:column;gap:calc(var(--u)*2.5)}
.doc .b-hero{padding:0 0 calc(var(--u)*2)}.doc .blk-h{font-size:22px;margin:calc(var(--u)*2) 0 calc(var(--u)*1.5)}
.widget{max-width:440px;margin:calc(var(--u)*5) auto;padding:calc(var(--u)*3);border:1px solid var(--line);border-radius:calc(var(--r)*1.4);display:flex;flex-direction:column;gap:calc(var(--u)*2.5);box-shadow:0 1px 2px rgba(0,0,0,.05),0 12px 32px rgba(0,0,0,.07)}
.widget .b-h{margin:0}.b-input{display:flex;flex-direction:column;gap:8px;font-size:15px}.b-input .lab{font-weight:600}.b-input input[type=number]{font:inherit;padding:10px 12px;border:1px solid var(--field);border-radius:calc(var(--r)*.7);min-height:44px;background:var(--surface);color:var(--ink);font-variant-numeric:tabular-nums}
.b-input input[type=range]{accent-color:var(--accent);min-height:32px}.b-input.tog{flex-direction:row;justify-content:space-between;align-items:center}.b-input.tog input{width:22px;height:22px;accent-color:var(--accent)}
.b-input i{font-style:normal;color:var(--muted);font-size:14px}.seg{display:flex;gap:6px;flex-wrap:wrap}.seg button{flex:1;min-height:44px;border-radius:calc(var(--r)*.7);border:1px solid var(--field);background:var(--surface);color:var(--ink);font:inherit;cursor:pointer}.seg button[aria-pressed=true]{background:var(--ink);color:var(--surface);border-color:var(--ink)}
.b-result{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-top:calc(var(--u)*2);border-top:1px solid var(--line)}.b-result span{color:var(--muted)}.b-result output{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums}
.widget .b-result + .b-result{border-top:0;padding-top:0}.widget .b-result + .b-result output{font-size:20px}`;

function widgetScript() {
  return `<script>(function(){var expr=${expr.toString()};
var fmt=${formatValue.toString().replace(/^function formatValue/, "function")};
function val(el){var k=el.dataset.kind;if(k==='toggle')return el.checked?1:0;if(k==='choice'){var on=el.querySelector('[aria-pressed=true]');return on?parseFloat(on.dataset.v):0;}return parseFloat(el.value);}
function run(){var v={};document.querySelectorAll('[data-in]').forEach(function(el){v[el.dataset.in]=val(el);});
document.querySelectorAll('[data-show]').forEach(function(el){el.textContent=v[el.dataset.show];});
document.querySelectorAll('output[data-expr]').forEach(function(o){var e=expr(o.dataset.expr);o.textContent=e.ok?fmt(e.run(v),o.dataset.format,{currency:o.dataset.currency,unit:o.dataset.unit}):'—';});}
document.addEventListener('input',run);document.addEventListener('change',run);
document.addEventListener('click',function(ev){var b=ev.target.closest('.seg button');if(!b)return;b.parentNode.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',String(x===b));});run();});
document.addEventListener('submit',function(ev){var f=ev.target;if(!f.classList.contains('b-form'))return;ev.preventDefault();var bad=null;f.querySelectorAll('input[required]').forEach(function(i){var ok=i.checkValidity()&&i.value.trim();i.setAttribute('aria-invalid',String(!ok));if(!ok&&!bad)bad=i;});if(bad){bad.focus();return;}var d=f.querySelector('.done');d.textContent=f.dataset.done;d.hidden=false;});
var editing=false,css=document.createElement('style');css.textContent='html.fold-edit [data-b]{cursor:pointer}html.fold-edit [data-b]:hover{outline:2px dashed #1d4ed8;outline-offset:3px}html.fold-edit [data-b].fold-on{outline:2px solid #1d4ed8;outline-offset:3px}';document.head.appendChild(css);
window.addEventListener('message',function(ev){var d=ev.data||{};if(d.fold==='edit'){editing=!!d.on;document.documentElement.classList.toggle('fold-edit',editing);}if(d.fold==='select'){document.querySelectorAll('.fold-on').forEach(function(x){x.classList.remove('fold-on');});var t=d.name&&document.querySelector('[data-b="'+d.name+'"]');if(t)t.classList.add('fold-on');}});
document.addEventListener('click',function(ev){if(!editing)return;var b=ev.target.closest('[data-b]');if(!b)return;ev.preventDefault();ev.stopPropagation();parent.postMessage({fold:'pick',name:b.dataset.b},'*');},true);
document.addEventListener('click',function(ev){var a=ev.target.closest('a[href]');if(!a||editing)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='#'){ev.preventDefault();var t=h.length>1&&document.getElementById(h.slice(1));if(t)window.scrollTo({top:t.getBoundingClientRect().top+window.scrollY-12,behavior:'smooth'});}else if(window.parent!==window){ev.preventDefault();}});
run();parent.postMessage({fold:'ready'},'*');})();<\/script>`;
}

/** The whole artifact as one HTML document. `model` = { theme, rooms, blocks, app, order } (fold-blocks-kernel toModel). */
export function render(model) {
  const { theme = {}, rooms = {}, blocks = {}, app = null, order = [] } = model || {};
  const kind = app?.kind || "website";
  const childOf = new Set(Object.values(blocks).flatMap((b) => (BLOCKS[b.type]?.container ? b.props.children || [] : [])));
  const top = (app?.blocks?.length ? app.blocks : order.filter((n) => blocks[n] && !childOf.has(n))).filter((n) => blocks[n] && !BLOCKS[blocks[n].type]?.ambient);
  const seen = new Set();
  const ctx = { rooms, kind, child: (n) => draw(n) };
  function draw(n) {
    const b = blocks[n]; if (!b || seen.has(n)) return ""; seen.add(n);
    const def = BLOCKS[b.type]; if (!def) return "";
    // every block's root carries its name, so a person can point at it to edit it
    try { return def.render(b.props, ctx).replace(/^\s*<([a-z][\w-]*)/i, `<$1 data-b="${esc(n)}"`); } catch { return `<div class="b-empty" data-b="${esc(n)}">${esc(n)} could not be drawn</div>`; }
  }
  const body = top.map((n) => {
    const t = blocks[n].type, html = draw(n);
    if (kind !== "website" || t === "section") return html;
    return t === "nav" || t === "hero" || t === "footer" ? `<div class="wrap">${html}</div>` : `<div class="wrap pad">${html}</div>`;
  }).join("\n");
  const vars = Object.entries(themeVars(theme)).map(([k, v]) => `${k}:${v}`).join(";");
  const main = kind === "document" ? `<main class="doc">${body}</main>` : kind === "widget" ? `<main class="widget">${body}</main>` : `<main>${body}</main>`;
  const title = blocks[top.find((n) => blocks[n].type === "hero" || blocks[n].type === "heading") || ""]?.props;
  const titleText = app?.title || title?.title || title?.text || "Untitled";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titleText)}</title><style>:root{${vars}}${CSS}</style></head><body>${main}${widgetScript()}</body></html>`;
}
