// fold-chat-compute.js — a mechanical evaluator for plain arithmetic, percent and
// unit questions. Pure: no DOM, no IO, no model, NO eval().
//
// Constitution II.9 (the mouth test): a model must never author a value. "What
// is 15% of 240?" has exactly one answer, and a small model that does the
// multiplication itself is a model-originated number. So the fold computes it
// here and the model only PHRASES the result (the surface hands it the computed
// line and then checks that the phrasing kept the figures: `answerKeeps`).
//
// The classifier asks `evaluate(question)`; a question is a COMPUTE turn only
// when this whole question parses (after a declared question stem is removed)
// as a closed expression. Anything else — a word we do not know, a unit we do
// not hold — returns { ok:false } and the turn is searched as before. That is
// the conservative direction: a wasted search is cheaper than a wrong skip.
//
// WHAT IS DECLARED, WHAT IS MEASURED (Constitution II.11): nothing in this file
// is a measured threshold. The question stems and operator words are DECLARED
// vocabulary (per language, as written here). The unit factors are DEFINITIONAL
// (1 in = 0.0254 m exactly, 1 lb = 0.45359237 kg exactly, 1 US gal =
// 3.785411784 L exactly) — they have a giver, the SI/US customary definitions.

// ── declared question stems, per language (stripped from the front) ────────
const STEMS = [
  // en
  "what is", "what's", "whats", "what are", "how much is", "how much are", "how many is", "calculate", "calc", "compute", "solve", "evaluate", "work out", "tell me", "can you calculate", "can you compute", "can you tell me", "could you calculate", "please calculate", "please",
  // es / pt
  "cuánto es", "cuanto es", "cuánto son", "cuanto son", "cuál es el resultado de", "calcula", "calcular", "quanto é", "quanto e", "quanto são", "calcule",
  // fr
  "combien font", "combien fait", "combien vaut", "combien font", "calcule", "calculer", "quel est le résultat de", "quel est le resultat de",
  // de
  "was ist", "was sind", "wie viel ist", "wieviel ist", "wie viel sind", "berechne", "rechne", "ergebnis von",
  // ru
  "сколько будет", "сколько получится", "сколько", "вычисли", "посчитай", "чему равно",
  // zh / ja
  "计算", "算一下", "请计算", "請計算", "計算して", "計算",
];
const STEM_RE = new RegExp("^(?:" + [...new Set(STEMS)].sort((a, b) => b.length - a.length).map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?=[\\s\\d(\\-+$€£√]|$)", "iu");
// declared trailing stems ("... equals how much", zh "等于多少", "是多少")
const TAIL_RE = /\s*(?:=\s*\??|equals\??|等于多少|等於多少|是多少|多少|等于几|是多少呢|は？|は\?|ist das\??|ça fait combien|es igual a\??)\s*$/iu;

// ── operator words (declared, English; symbols are language-neutral) ───────
const WORD_OPS = [
  [/\bmultiplied by\b/g, "*"], [/\btimes\b/g, "*"], [/\bdivided by\b/g, "/"], [/\bover\b/g, "/"],
  [/\bplus\b/g, "+"], [/\bminus\b/g, "-"], [/\bto the power of\b/g, "^"], [/\bsquared\b/g, "^2"], [/\bcubed\b/g, "^3"],
  [/\bmodulo\b/g, "%%"], [/\bmod\b/g, "%%"],
  [/\bpercent\b/g, "%"], [/\bper cent\b/g, "%"],
  [/\b(?:prozent|pour\s?cent|por\s?ciento|por\s?cento|процент(?:ов|а)?)\b/g, "%"],
  [/\bsquare root of\b/g, "sqrt "], [/\bsqrt of\b/g, "sqrt "],
  // es/fr/pt/de "de" / "von" / "от" between a percent and a base read as "of"
  [/%\s*(?:de|d'|du|des|von|van|от|的)\s*/g, "% of "],
  [/(\d+(?:\.\d+)?)\s*的\s*(\d+(?:\.\d+)?\s*%)/g, "$2 of $1"],     // zh: 240的15%
];

// ── tokenizer + recursive-descent parser (the whole grammar) ───────────────
function tokenize(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m;
    if ((m = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?|^\d+(?:\.\d+)?|^\.\d+/.exec(s.slice(i)))) { out.push({ t: "num", v: Number(m[0].replace(/,/g, "")), raw: m[0] }); i += m[0].length; continue; }
    if (s.startsWith("%%", i)) { out.push({ t: "op", v: "%%" }); i += 2; continue; }
    if (/^of\b/.test(s.slice(i))) { out.push({ t: "of" }); i += 2; continue; }
    if ((m = /^sqrt\b|^√/.exec(s.slice(i)))) { out.push({ t: "fn", v: "sqrt" }); i += m[0].length; continue; }
    if ("+-*/^()%".includes(c)) { out.push({ t: c === "(" || c === ")" ? c : c === "%" ? "pct" : "op", v: c }); i++; continue; }
    if (c === "×" || c === "·" || c === "x" || c === "X") { out.push({ t: "op", v: "*" }); i++; continue; }
    if (c === "÷") { out.push({ t: "op", v: "/" }); i++; continue; }
    if (c === "−" || c === "–") { out.push({ t: "op", v: "-" }); i++; continue; }
    return null;                                   // a character outside the grammar: not arithmetic
  }
  return out;
}

class Parse {
  constructor(tokens) { this.t = tokens; this.i = 0; this.operands = []; this.percent = false; this.ops = 0; }
  peek() { return this.t[this.i]; }
  next() { return this.t[this.i++]; }
  fail(why) { const e = new Error(why); e.parse = true; throw e; }
  expr() {
    let v = this.term();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.v === "+" || p.v === "-")) { this.next(); this.ops++; const r = this.term(); v = p.v === "+" ? v + r : v - r; } else return v;
    }
  }
  term() {
    let v = this.power();
    for (;;) {
      const p = this.peek();
      if (p && p.t === "op" && (p.v === "*" || p.v === "/" || p.v === "%%")) {
        this.next(); this.ops++; const r = this.power();
        if (p.v === "*") v = v * r;
        else if (p.v === "/") { if (r === 0) this.fail("division by zero"); v = v / r; }
        else { if (r === 0) this.fail("modulo by zero"); v = v % r; }
      } else if (p && p.t === "of") {                   // "15% of 240": the percent already became 0.15
        if (!this.percent) this.fail("'of' without a percent");
        this.next(); this.ops++; v = v * this.power();
      } else return v;
    }
  }
  power() {
    const base = this.unary();
    const p = this.peek();
    if (p && p.t === "op" && p.v === "^") { this.next(); this.ops++; const e = this.power(); const r = Math.pow(base, e); if (!Number.isFinite(r)) this.fail("overflow"); return r; }
    return base;
  }
  unary() {
    const p = this.peek();
    if (p && p.t === "op" && (p.v === "-" || p.v === "+")) { this.next(); const v = this.unary(); return p.v === "-" ? -v : v; }
    return this.postfix();
  }
  postfix() {
    let v = this.atom();
    while (this.peek() && this.peek().t === "pct") { this.next(); this.percent = true; this.ops++; v = v / 100; }
    return v;
  }
  atom() {
    const p = this.next();
    if (!p) this.fail("unexpected end");
    if (p.t === "num") { this.operands.push(p.v); return p.v; }
    if (p.t === "fn") { const v = this.atom(); if (v < 0) this.fail("sqrt of a negative"); this.ops++; return Math.sqrt(v); }
    if (p.t === "(") { const v = this.expr(); if (!this.next() || this.t[this.i - 1].t !== ")") this.fail("missing )"); return v; }
    this.fail("unexpected " + (p.v || p.t));
  }
}

/** Evaluate a closed arithmetic expression string. Returns { ok, value, operands, ops, percent } or { ok:false, why }. */
export function evalExpression(src) {
  const toks = tokenize(String(src ?? "").trim());
  if (!toks || !toks.length) return { ok: false, why: "not an expression" };
  const p = new Parse(toks);
  try {
    const value = p.expr();
    if (p.i !== toks.length) return { ok: false, why: "trailing tokens" };
    if (!Number.isFinite(value)) return { ok: false, why: "not finite" };
    return { ok: true, value, operands: p.operands, ops: p.ops, percent: p.percent, tokens: toks };
  } catch (e) { return { ok: false, why: e.parse ? e.message : String(e.message || e) }; }
}

// ── units (definitional factors) ───────────────────────────────────────────
// to-base factor: value_in_base = value * f. Temperature is handled separately.
const UNITS = {
  length: { base: "m", u: { m: 1, meter: 1, meters: 1, metre: 1, metres: 1, km: 1000, kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000, cm: 0.01, centimeter: 0.01, centimeters: 0.01, mm: 0.001, millimeter: 0.001, millimeters: 0.001, mi: 1609.344, mile: 1609.344, miles: 1609.344, ft: 0.3048, foot: 0.3048, feet: 0.3048, in: 0.0254, inch: 0.0254, inches: 0.0254, yd: 0.9144, yard: 0.9144, yards: 0.9144 } },
  mass: { base: "kg", u: { kg: 1, kilogram: 1, kilograms: 1, kilo: 1, kilos: 1, g: 0.001, gram: 0.001, grams: 0.001, mg: 0.000001, lb: 0.45359237, lbs: 0.45359237, pound: 0.45359237, pounds: 0.45359237, oz: 0.028349523125, ounce: 0.028349523125, ounces: 0.028349523125, stone: 6.35029318, t: 1000, tonne: 1000, tonnes: 1000 } },
  volume: { base: "l", u: { l: 1, liter: 1, liters: 1, litre: 1, litres: 1, ml: 0.001, milliliter: 0.001, milliliters: 0.001, gal: 3.785411784, gallon: 3.785411784, gallons: 3.785411784, qt: 0.946352946, quart: 0.946352946, quarts: 0.946352946, pt: 0.473176473, pint: 0.473176473, pints: 0.473176473, cup: 0.2365882365, cups: 0.2365882365, floz: 0.0295735295625, tbsp: 0.01478676478125, tsp: 0.00492892159375 } },
  speed: { base: "m/s", u: { "m/s": 1, mps: 1, "km/h": 1 / 3.6, kph: 1 / 3.6, kmh: 1 / 3.6, mph: 0.44704, "mi/h": 0.44704, knot: 0.5144444444444445, knots: 0.5144444444444445 } },
  time: { base: "s", u: { s: 1, sec: 1, second: 1, seconds: 1, min: 60, minute: 60, minutes: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600, day: 86400, days: 86400, week: 604800, weeks: 604800 } },
};
const TEMP = { c: "C", celsius: "C", "°c": "C", f: "F", fahrenheit: "F", "°f": "F", k: "K", kelvin: "K" };
const UNIT_LABEL = { feet: "ft", foot: "ft", inches: "in", inch: "in", miles: "mi", mile: "mi", meters: "m", metres: "m", meter: "m", metre: "m", kilometers: "km", kilometres: "km", kilometer: "km", kilometre: "km", pounds: "lb", pound: "lb", lbs: "lb", ounces: "oz", ounce: "oz", kilograms: "kg", kilogram: "kg", kilos: "kg", kilo: "kg", grams: "g", gram: "g", liters: "l", litres: "l", liter: "l", litre: "l", gallons: "gal", gallon: "gal", celsius: "°C", fahrenheit: "°F", kelvin: "K", c: "°C", f: "°F", k: "K", "°c": "°C", "°f": "°F", mph: "mph", kph: "km/h", kmh: "km/h", kilometre: "km" };
const labelOf = (u) => UNIT_LABEL[u] || u;
function unitKind(u) {
  for (const [k, def] of Object.entries(UNITS)) if (Object.prototype.hasOwnProperty.call(def.u, u)) return k;
  if (Object.prototype.hasOwnProperty.call(TEMP, u)) return "temp";
  return null;
}
function convertTemp(v, from, to) {
  const c = from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15;
  return to === "C" ? c : to === "F" ? c * 9 / 5 + 32 : c + 273.15;
}

/** Convert a number between two units of the SAME kind; null if either is unknown or the kinds differ. */
export function convertUnits(n, from, to) {
  const f = String(from).toLowerCase(), t = String(to).toLowerCase();
  const kf = unitKind(f), kt = unitKind(t);
  if (!kf || kf !== kt) return null;
  if (kf === "temp") return convertTemp(n, TEMP[f], TEMP[t]);
  return (n * UNITS[kf].u[f]) / UNITS[kf].u[t];
}

// "convert 5 miles to km", "5 miles in km", "100 f to c", "how many feet in 330 meters"
const UNIT_TOKEN = "°?[a-z]+(?:/[a-z]+)?";
const CONV_A = new RegExp(`^(?:convert\\s+)?(-?\\d[\\d,]*(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\s+(?:to|in|into|as|->|=|→)\\s+(${UNIT_TOKEN})$`, "iu");
const CONV_B = new RegExp(`^how many\\s+(${UNIT_TOKEN})\\s+(?:are\\s+)?(?:in|are in|is in|per)\\s+(?:a|an|one|1|(-?\\d[\\d,]*(?:\\.\\d+)?))\\s*(${UNIT_TOKEN})$`, "iu");
const CONV_C = new RegExp(`^(?:what is|what's)\\s+(-?\\d[\\d,]*(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\s+(?:in|to|into)\\s+(${UNIT_TOKEN})$`, "iu");

/** Format a number for a person: up to 10 significant digits, no trailing zeros, no exponent for ordinary sizes. */
export function fmtNumber(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Object.is(v, -0)) v = 0;
  const s = Number(v.toPrecision(10));
  const a = Math.abs(s);
  if (a !== 0 && (a >= 1e15 || a < 1e-9)) return s.toExponential(6).replace(/\.?0+e/, "e");
  const str = String(s);
  if (/e/i.test(str)) return s.toFixed(10).replace(/\.?0+$/, "");
  return str;
}

const clean = (q) => String(q ?? "").trim().replace(/[¿¡]/g, "").replace(/[?？!！。.]+$/u, "").replace(/\s+/g, " ").trim();

/** Does this question PARSE as arithmetic / percent / a unit conversion? If so,
 *  the answer, mechanically. Never throws.
 *  { ok:true, kind:'arith'|'unit', expr, value, valueText, text, operands, unit? }
 *  | { ok:false, why } */
export function evaluate(question) {
  let q = clean(question);
  if (!q || q.length > 120) return { ok: false, why: "not a short closed question" };
  const hadStem = STEM_RE.test(q);
  let body = q;
  for (let n = 0; n < 3 && STEM_RE.test(body); n++) body = body.replace(STEM_RE, "").trim();
  let hadTail = false;
  const t2 = body.replace(TAIL_RE, "");
  if (t2 !== body) { hadTail = true; body = t2.trim(); }
  body = body.replace(/^the\s+/i, "");
  // currency: $240 / 240$ / €5 — carried back into the printed result when ONE symbol is used
  const cur = [...new Set(body.match(/[$€£]/g) || [])];
  const plain = body.replace(/[$€£]/g, "");
  const currency = cur.length === 1 ? cur[0] : "";
  // 1) unit conversions
  const lower = plain.toLowerCase().replace(/\s+/g, " ").trim();
  let mm;
  if ((mm = CONV_A.exec(lower)) || (mm = CONV_C.exec(lower))) {
    const n = Number(mm[1].replace(/,/g, "")), r = convertUnits(n, mm[2], mm[3]);
    if (r != null) return unitResult(n, mm[2], mm[3], r);
  } else if ((mm = CONV_B.exec(lower))) {
    const n = mm[2] ? Number(mm[2].replace(/,/g, "")) : 1, r = convertUnits(n, mm[3], mm[1]);
    if (r != null) return unitResult(n, mm[3], mm[1], r);
  }
  // 2) arithmetic: operator words become symbols, then the closed grammar decides
  let src = lower;
  for (const [re, to] of WORD_OPS) src = src.replace(re, to);
  src = src.replace(/\s+/g, " ").trim();
  // a bare year range ("1990-2000") or a lone number is not a calculation
  if (/^\d{4}\s*-\s*\d{4}$/.test(src)) return { ok: false, why: "a year range" };
  const ev = evalExpression(src);
  if (!ev.ok) return { ok: false, why: ev.why };
  if (ev.ops < 1 || ev.operands.length < 1) return { ok: false, why: "no operation" };
  // Without a stem or a trailing '=', require at least two operands or a percent, so
  // "(5)" or "-3" alone never become a computed turn.
  if (!hadStem && !hadTail && ev.operands.length < 2 && !ev.percent && !/sqrt/.test(src)) return { ok: false, why: "no stem and no second operand" };
  const expr = renderTokens(ev.tokens, currency);
  const valueText = (currency ? currency : "") + fmtNumber(ev.value);
  return { ok: true, kind: "arith", expr, value: ev.value, valueText, text: `${expr} = ${valueText}`, operands: ev.operands, percent: ev.percent };
}

/** The expression as a person reads it: numbers (with a currency symbol on plain amounts, never on a percent), spaced operators. */
function renderTokens(toks, currency = "") {
  let out = "";
  toks.forEach((t, i) => {
    const nextPct = toks[i + 1] && toks[i + 1].t === "pct";
    if (t.t === "num") out += (currency && !nextPct ? currency : "") + t.raw;
    else if (t.t === "pct") out += "%";
    else if (t.t === "of") out += " of ";
    else if (t.t === "fn") out += "√";
    else if (t.t === "(" || t.t === ")") out += t.t;
    else if (t.t === "op") {
      const unaryPos = i === 0 || ["op", "(", "of", "fn"].includes(toks[i - 1].t);
      const sym = t.v === "*" ? "×" : t.v === "/" ? "÷" : t.v === "%%" ? "mod" : t.v;
      out += unaryPos && (t.v === "-" || t.v === "+") ? sym : t.v === "^" ? "^" : ` ${sym} `;
    }
  });
  return out.replace(/\s+/g, " ").trim();
}

function unitResult(n, from, to, r) {
  const f = labelOf(from.toLowerCase()), t = labelOf(to.toLowerCase());
  const expr = `${fmtNumber(n)} ${f}`;
  const valueText = `${fmtNumber(r)} ${t}`;
  return { ok: true, kind: "unit", expr, value: r, valueText, text: `${expr} = ${valueText}`, operands: [n], unit: t };
}

/** Every number in a text, as numbers (thousands separators and a decimal comma tolerated). */
export function numbersOf(text) {
  const out = [];
  for (const m of String(text ?? "").matchAll(/\d[\d.,   ]*\d|\d/g)) {
    let raw = m[0].replace(/[   ]/g, "");
    // 1,234.5 / 1.234,5 / 1234,5
    if (/,\d{1,2}$/.test(raw) && !/\./.test(raw.replace(/\.\d{3}/g, ""))) raw = raw.replace(/\./g, "").replace(",", ".");
    else raw = raw.replace(/,/g, "");
    const v = Number(raw);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/** Did the model's phrasing keep the computed figures and add none of its own?
 *  The answer may contain the result (to any precision it printed up to 4 decimals),
 *  and the question's own operands; any OTHER number is the mouth originating a
 *  value (II.9) and the phrasing is refused. */
export function answerKeeps(answer, computed) {
  if (!computed || !computed.ok) return { ok: true, extra: [], hasResult: true };
  const nums = numbersOf(answer);
  const allowed = [computed.value, ...computed.operands, ...(computed.percent ? computed.operands.map((o) => o / 100) : [])];
  const near = (a, b) => Math.abs(a - b) <= Math.abs(b) * 0.0005 + 1e-9;
  const hasResult = nums.some((n) => near(n, computed.value)) || nums.some((n) => near(n, Math.round(computed.value * 100) / 100));
  const extra = nums.filter((n) => !allowed.some((a) => near(n, a)) && !(Math.abs(n - Math.round(computed.value * 100) / 100) < 1e-9));
  return { ok: hasResult && extra.length === 0, extra, hasResult };
}
