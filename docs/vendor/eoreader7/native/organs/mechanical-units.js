// native/organs/mechanical-units.js — the a priori code units (Kant, 2026-10-01,
// GL-BD-12): logic is the understanding's own contribution, never the mouth's.
//
// A unit whose logic is derivable from its own name/spec is a CATEGORY — the box
// computes it, deterministically, 0 draws. The mouth draws only the residue no
// category covers (novel names, novel paraphrase, judgment under uncertainty,
// prose). Asking an empirical faculty to legislate is how dialectical illusion
// is manufactured: the small mouth produced "necessarily-looking" logic for
// toCamelCase/toSnakeCase that failed 4/10 golden pairs (measured 2026-10-01).
// The gate is the bow still — a box-computed body must pass the same testCommand
// a drawn one would; if a category's own body fails its shape's golden cases,
// the category is wrong, and that is the finding (never a retry).
//
// MEDIUM-AWARE (2026-10-01, GL-BD-12): the a priori logic is language-neutral;
// the syntax is the medium. A category may carry a body in each language the box
// legislates (js + python); a shape with no body for the ask's language is NOT a
// category for that language — it routes to the mouth (the residue is open). The
// name is normalized across medium (to_camel_case ≡ toCamelCase) — the name
// legislates the rule, the underscore is the notation.
//
// PURE: no imports, no model, no DOM. Each shape is a closed form — the a priori
// list is CLOSED by construction; a name no category owns routes to the mouth.
// Selftest: node --input-type=module -e "import('./mechanical-units.js').then(m=>m.selftest())"

/** Each category: canonical names, and the deterministic body per language.
 *  `names` are matched NORMALIZED (lowercase, underscores stripped). */
const SHAPES = [
  {
    names: new Set(["clamp"]),
    js: `function clamp(n, lo, hi) {\n  return Math.max(lo, Math.min(hi, n));\n}`,
    py: `def clamp(n, lo, hi):\n    return max(lo, min(hi, n))`,
  },
  {
    names: new Set(["lerp", "interpolate"]),
    js: `function lerp(a, b, t) {\n  return (1 - t) * a + t * b;\n}`,
    py: `def lerp(a, b, t):\n    return (1 - t) * a + t * b`,
  },
  {
    names: new Set(["tocamelcase"]),
    js: `function toCamelCase(str) {\n  const s = String(str ?? "");\n  const sep = /[^a-zA-Z0-9]+/;\n  if (!sep.test(s)) return s.charAt(0).toLowerCase() + s.slice(1);\n  const words = s.split(sep).filter(Boolean);\n  return words.map((w, i) => {\n    const lower = w.toLowerCase();\n    return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);\n  }).join("");\n}`,
    py: `def to_camel_case(text):\n    import re\n    s = str(text or "")\n    if not re.search(r"[^A-Za-z0-9]", s):\n        return s[0].lower() + s[1:] if s else s\n    words = [w for w in re.split(r"[^A-Za-z0-9]+", s) if w]\n    return words[0].lower() + "".join(w[0].upper() + w[1:].lower() for w in words[1:])`,
  },
  {
    names: new Set(["tosnakecase"]),
    js: `function toSnakeCase(str) {\n  return String(str ?? "")\n    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")\n    .replace(/[\\s\\-]+/g, "_")\n    .toLowerCase();\n}`,
    py: `def to_snake_case(text):\n    import re\n    s = str(text or "")\n    s = re.sub(r"([a-z0-9])([A-Z])", r"\\1_\\2", s)\n    return re.sub(r"[\\s\\-]+", "_", s).lower()`,
  },
  {
    names: new Set(["tokebabcase"]),
    js: `function toKebabCase(str) {\n  return String(str ?? "")\n    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")\n    .replace(/[\\s_]+/g, "-")\n    .toLowerCase();\n}`,
    py: `def to_kebab_case(text):\n    import re\n    s = str(text or "")\n    s = re.sub(r"([a-z0-9])([A-Z])", r"\\1-\\2", s)\n    return re.sub(r"[\\s_]+", "-", s).lower()`,
  },
  {
    names: new Set(["totitlecase"]),
    js: `function toTitleCase(str) {\n  return String(str ?? "").split(/[^a-zA-Z0-9]+/).filter(Boolean)\n    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())\n    .join(" ");\n}`,
    py: `def to_title_case(text):\n    import re\n    return " ".join(w[0].upper() + w[1:].lower() for w in re.split(r"[^A-Za-z0-9]+", str(text or "")) if w)`,
  },
  {
    names: new Set(["slugify", "slug"]),
    js: `function slugify(str) {\n  return String(str ?? "").trim().toLowerCase()\n    .replace(/[^a-z0-9]+/g, "-")\n    .replace(/^-+|-+$/g, "");\n}`,
    py: `def slugify(text):\n    import re\n    s = re.sub(r"[^a-z0-9]+", "-", str(text or "").strip().lower())\n    return s.strip("-")`,
  },
  {
    names: new Set(["countwords", "wordcount"]),
    js: `function countWords(str) {\n  return String(str ?? "").match(/\\S+/g)?.length ?? 0;\n}`,
    py: `def count_words(text):\n    return len(str(text or "").split())`,
  },
  {
    names: new Set(["capitalize"]),
    js: `function capitalize(str) {\n  const s = String(str ?? "");\n  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();\n}`,
    py: `def capitalize(text):\n    s = str(text or "")\n    return s[0].upper() + s[1:].lower() if s else s`,
  },
  {
    names: new Set(["pluralize"]),
    js: `function pluralize(word, count) {\n  const w = String(word ?? "");\n  return Number(count) === 1 ? w : w + "s";\n}`,
    py: `def pluralize(word, count):\n    w = str(word or "")\n    return w if count == 1 else w + "s"`,
  },
  {
    names: new Set(["formatbytes"]),
    js: `function formatBytes(n) {\n  const units = ["B", "KB", "MB", "GB", "TB"];\n  let v = Number(n) || 0, i = 0;\n  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }\n  return v.toFixed(i ? 1 : 0) + " " + units[i];\n}`,
    py: `def format_bytes(n):\n    units = ["B", "KB", "MB", "GB", "TB"]\n    v = float(n or 0)\n    i = 0\n    while v >= 1024 and i < len(units) - 1:\n        v /= 1024\n        i += 1\n    return ("%.1f" % v if i else "%.0f" % v) + " " + units[i]`,
  },
  {
    names: new Set(["fmtduration", "duration"]),
    js: `function fmtDuration(ms) {\n  const s = Math.round((Number(ms) || 0) / 1000);\n  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;\n  return h ? h + "h " + m + "m" : m ? m + "m " + sec + "s" : sec + "s";\n}`,
    py: `def fmt_duration(ms):\n    s = round(int(ms or 0) / 1000)\n    h, m = s // 3600, (s % 3600) // 60\n    sec = s % 60\n    return ("%dh %dm" % (h, m)) if h else (("%dm %ds" % (m, sec)) if m else ("%ds" % sec))`,
  },
];

const BY_NAME = new Map();
for (const shape of SHAPES) for (const n of shape.names) BY_NAME.set(n, shape);

const normalize = (name) => String(name ?? "").toLowerCase().replace(/_/g, "");

/** The category the unit's name legislates, in the ask's language —
 *  { ok, shape, body } or { ok:false } (an unowned name, or a category with no
 *  body for this language — the residue is open). */
export function mechanicalUnitBody(name, language = "js") {
  const shape = BY_NAME.get(normalize(name));
  if (!shape) return { ok: false };
  const body = language === "python" ? shape.py : shape.js;
  if (!body) return { ok: false };
  return { ok: true, shape: [...shape.names][0], body };
}

/** The closed set of categories the box owns (the a priori list — disclosed). */
export const mechanicalShapes = () => [...new Set(SHAPES.flatMap((s) => [...s.names]))];

export async function selftest() {
  const { execFileSync } = await import("node:child_process");
  const t = (n, c) => { if (!c) { console.error("FAIL", n); process.exitCode = 1; } else console.log("ok", n); };
  t("clamp is a category in js and python", mechanicalUnitBody("clamp", "js").ok && mechanicalUnitBody("clamp", "python").body.includes("def clamp"));
  t("the name normalizes across medium", mechanicalUnitBody("to_camel_case", "python").ok && mechanicalUnitBody("toCamelCase", "js").ok && mechanicalUnitBody("to_camel_case", "js").ok);
  t("debounce is NOT a category (the residue is open)", !mechanicalUnitBody("debounce", "js").ok && !mechanicalUnitBody("debounce", "python").ok);
  t("unknown name is null, never a guess", !mechanicalUnitBody("computeSchedule", "js").ok);
  const run = async (name, lang, calls) => {
    const b = mechanicalUnitBody(name, lang).body;
    const f = new Function(b + "\nreturn " + name + ";")();
    return calls.map(([args, want]) => [JSON.stringify(args), f(...args), want]);
  };
  const runPy = async (name, lang, calls) => {
    // a REAL behavior pin: the python body is executed through python3, never
    // compiled as js. The module stays pure — child_process is pulled only here,
    // test-only.
    const b = mechanicalUnitBody(name, "python").body;
    const asserts = calls.map(([args, want]) => `assert ${name}(${args.map((a) => JSON.stringify(a)).join(", ")}) == ${JSON.stringify(want)}, ${JSON.stringify(name + JSON.stringify(args))}`);
    execFileSync("python3", ["-c", b + "\n" + asserts.join("\n") + "\nprint('ok')"], { encoding: "utf8", stdio: "pipe" });
    return calls.map(([args, want]) => [JSON.stringify(args), want, want]);
  };
  for (const [label, lang, name, calls] of [
    ["js toCamelCase", "js", "toCamelCase", [[["hello world"], "helloWorld"], [["snake_case_text"], "snakeCaseText"], [["foo-bar-baz"], "fooBarBaz"], [["alreadyCamel"], "alreadyCamel"], [[""], ""]]],
    ["js toSnakeCase", "js", "toSnakeCase", [[["helloWorld"], "hello_world"], [["fooBarBaz"], "foo_bar_baz"], [["hello world"], "hello_world"], [["already_snake"], "already_snake"], [[""], ""]]],
    ["py to_camel_case", "python", "to_camel_case", [[["hello world"], "helloWorld"], [["snake_case_text"], "snakeCaseText"], [["alreadyCamel"], "alreadyCamel"], [[""], ""]]],
    ["py to_snake_case", "python", "to_snake_case", [[["helloWorld"], "hello_world"], [["fooBarBaz"], "foo_bar_baz"], [["hello world"], "hello_world"], [["already_snake"], "already_snake"], [[""], ""]]],
    ["py clamp", "python", "clamp", [[[5, 0, 10], 5], [[-3, 0, 10], 0], [[42, 0, 10], 10]]],
  ]) {
    const fails = await (lang === "python" ? runPy : run)(name, lang, calls).then((r) => r).catch((e) => { console.error("FAIL", label, "python3 rejected the body:", String(e.message).slice(0, 140)); process.exitCode = 1; return []; }).then((r) => r.filter(([, got, want]) => got !== want));
    if (fails.length) { console.error("FAIL", label, fails.map(([args, got, want]) => `${name}${args} = ${JSON.stringify(got)}, want ${JSON.stringify(want)}`).join("; ")); process.exitCode = 1; }
    else console.log("ok", label, `${calls.length} golden cases`);
  }
  const names = mechanicalShapes();
  t("the closed list is distinct and named", names.length === new Set(names).size && names.every((n) => /^[a-z]+$/.test(n)));
}