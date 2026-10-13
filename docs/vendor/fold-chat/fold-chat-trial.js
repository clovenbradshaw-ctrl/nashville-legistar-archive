// fold-chat-trial.js — "try it": find the functions a piece of code defines and choose sample calls for them.
//
// A function that loads is not a function that works. The sandbox (fold-chat-sandbox.js `callMany`) runs these sample
// calls and the Fold shows what came back, so the person SEES the result — `slugify("Hello, World!") → "hello--world"` —
// instead of being told "it works". Pure: no DOM, no network. The inputs are generic (chosen from parameter NAMES), never
// taken from the answer being judged, so a wrong answer cannot pick the examples that flatter it.

const IDENT = "[A-Za-z_$][\\w$]*";

/** The functions defined at the top level of `code`: [{ name, params:[string] }]. Declarations, arrow functions and function expressions. */
export function functionsIn(code) {
  const src = String(code ?? "");
  const out = [], seen = new Set();
  const add = (name, rawParams) => {
    if (!name || seen.has(name) || name.startsWith("_")) return;
    seen.add(name);
    const params = String(rawParams || "").split(",").map((p) => p.replace(/=.*$/, "").replace(/^\s*\.\.\./, "").trim()).filter((p) => /^[A-Za-z_$][\w$]*$/.test(p));
    out.push({ name, params });
  };
  for (const m of src.matchAll(new RegExp("^(?:export\\s+(?:default\\s+)?)?(?:async\\s+)?function\\s*\\*?\\s*(" + IDENT + ")\\s*\\(([^)]*)\\)", "gm"))) add(m[1], m[2]);
  for (const m of src.matchAll(new RegExp("^(?:export\\s+)?(?:const|let|var)\\s+(" + IDENT + ")\\s*=\\s*(?:async\\s*)?(?:function\\s*\\*?\\s*(?:" + IDENT + ")?\\s*\\(([^)]*)\\)|\\(([^)]*)\\)\\s*=>|(" + IDENT + ")\\s*=>)", "gm"))) add(m[1], m[2] ?? m[3] ?? m[4]);
  return out;
}

const TEXT = /title|text|str|string|name|word|sentence|input|^s$|slug|path|url|email|label|message|line|html|query/i;
const NUM = /^(n|i|j|k|x|y|a|b)$|num|count|index|amount|value|age|year|size|len|total|price|qty|limit|max|min|step/i;
const LIST = /arr|list|items|nums|values|xs|array|rows|words/i;
const OBJ = /obj|options|opts|config|data|record|state|props/i;

/** Sample inputs for one parameter, chosen from its NAME alone. */
export function samplesFor(param) {
  const p = String(param || "");
  if (LIST.test(p)) return [[3, 1, 2], [], ["b", "a", "b"]];
  if (OBJ.test(p)) return [{}, { a: 1, b: "x" }];
  if (TEXT.test(p) && !NUM.test(p)) return ["Hello, World!", "  Multiple   spaces & symbols!!  ", ""];
  if (NUM.test(p)) return [0, 7, -3];
  return ["abc", 3, ""];
}

/** A JS literal for a sample, for the expression text. */
const lit = (v) => (typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v));

/** Sample call expressions for the functions in `code`: at most `perFn` calls on at most `maxFns` functions. Deterministic. */
export function sampleCalls(code, { perFn = 3, maxFns = 3 } = {}) {
  const calls = [];
  for (const f of functionsIn(code).slice(0, maxFns)) {
    const per = f.params.map(samplesFor);
    const n = Math.min(perFn, per.length ? Math.max(...per.map((s) => s.length)) : 1);
    for (let k = 0; k < n; k++) calls.push(`${f.name}(${per.map((s) => lit(s[k % s.length])).join(", ")})`);
  }
  return calls;
}

/** How a returned value is shown: short, JSON where it can be, and honest about undefined. */
export function formatValue(v, max = 160) {
  let t;
  if (v === undefined) t = "undefined";
  else if (typeof v === "function") t = "[function]";
  else if (typeof v === "string") t = JSON.stringify(v);
  else { try { t = JSON.stringify(v); } catch { t = String(v); } if (t === undefined) t = String(v); }
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** One line for a trial result: `slugify("Hello") → "hello"` or `f(1) threw TypeError: …`. */
export function describeTrial(t) {
  return t.ok ? `${t.expr} → ${t.value}` : `${t.expr} threw ${t.error}`;
}
