// code-piece.js — a program built in the cube's own dependency order, with
// the model writing as little as possible (P117). Pure.
//
// User direction (2026-09-05): "leverage snipping and using the dependency
// order reasoning of the cube to create as little code manually with the
// model." The canonical chain NUL SIG INS SEG CON SYN DEF EVA REC is a
// strict dependency order, and a program has the same joints:
//   NUL  the spec: what is to exist and does not yet (the features)
//   SIG  the NAMES: one function per feature, named off the clause — mechanical
//   INS  the SKELETON: stubs with the clause as docstring, born as a build — mechanical
//   SEG  the SNIP: one function region at a time, the only thing the model sees and writes
//   CON  the WIRING: each function fed the previous one's result, in spec order — mechanical
//   SYN  the MAIN: the pipeline composed as the entry — mechanical
//   DEF  the CONTRACT: it runs to exit 0 and prints — declared, not asked
//   EVA  the RUN: the sandbox, after every landing — the witness, never the mouth
//   REC  the FIX: the failing function named by the traceback, asked once
// What the model emits is measured against what the instrument wrote
// (`modelShare`), so "as little as possible" is a number, not a claim.

const STOP = new Set(["a", "an", "the", "of", "to", "in", "on", "for", "with", "and", "or", "each", "every", "all", "its", "their", "from", "by", "as", "at", "that", "which", "then"]);
const fold = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** SIG — a function name from a feature clause: verb first, then the content nouns, snake_case, unique. */
export function namesFor(features) {
  const used = new Set();
  return features.map((f) => {
    const words = fold(f).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w));
    let name = words.slice(0, 4).join("_") || "step";
    if (/^\d/.test(name)) name = `do_${name}`;
    let n = name, i = 2;
    while (used.has(n)) n = `${name}_${i++}`;
    used.add(n);
    return n;
  });
}

const RUNTIMES = Object.freeze({
  python: {
    stub: (name, clause, arg) => `def ${name}(${arg}):\n    """${clause.replace(/"/g, "'")}"""\n    raise NotImplementedError("${name}")\n`,
    main: (names) => {
      // EVA per step: main reports each step's value to stderr — type and a
      // short repr — so the run witnesses what each function actually
      // returned, and the next snip can be told what `previous` IS.
      const lines = ["def main():"];
      let prev = null;
      // On stdout, not stderr: the sandbox reads any stderr as a failed run
      // (term.js: `code: err ? 1 : 0`), so the witness must not wear the
      // failure's channel. The lines are the program's own record of its
      // steps; the reader sees them beside the output.
      names.forEach((n, i) => { const v = `r${i + 1}`; lines.push(`    ${v} = ${n}(${prev ?? ""})`, `    print(f"[step ${i + 1} ${n}] {type(${v}).__name__}: {repr(${v})[:120]}")`); prev = v; });
      lines.push(`    return ${prev ?? "None"}`, "", "", 'if __name__ == "__main__":', "    main()", "");
      return lines.join("\n");
    },
    helperStub: (name) => `def ${name}(*args, **kwargs):\n    """helper the program calls"""\n    raise NotImplementedError("${name}")\n`,
    missing: (stderr) => { const m = String(stderr ?? "").match(/NameError: name '([A-Za-z_]\w*)' is not defined/); return m ? m[1] : null; },
    mainRe: /\ndef main\(\):/,
    header: (spec) => `"""${spec.replace(/"/g, "'")}"""\nimport random\nimport sys\n\n\n`,
    bodyRe: (name) => new RegExp(`(def ${name}\\([^)]*\\):\\n(?:    """[\\s\\S]*?"""\\n)?)([\\s\\S]*?)(?=\\n\\S|$)`),
    failing: (stderr, names) => { const lines = String(stderr ?? "").split("\n"); for (let i = lines.length - 1; i >= 0; i -= 1) { const m = lines[i].match(/in (\w+)\s*$/); if (m && names.includes(m[1])) return m[1]; } for (const n of names) if (String(stderr ?? "").includes(`NotImplementedError("${n}")`) || String(stderr ?? "").includes(`NotImplementedError: ${n}`)) return n; return null; },
    fence: "python",
    indent: "    ",
  },
  js: {
    stub: (name, clause, arg) => `function ${name}(${arg}) {\n  // ${clause}\n  throw new Error("not implemented: ${name}");\n}\n`,
    main: (names) => {
      const lines = ["function main() {"];
      let prev = null;
      names.forEach((n, i) => { const v = `r${i + 1}`; lines.push(`  const ${v} = ${n}(${prev ?? ""});`, `  console.log(\`[step ${i + 1} ${n}] \${typeof ${v}}: \${JSON.stringify(${v}).slice(0, 120)}\`);`); prev = v; });
      lines.push(`  return ${prev ?? "null"};`, "}", "", "main();", "");
      return lines.join("\n");
    },
    helperStub: (name) => `function ${name}() {\n  // helper the program calls\n  throw new Error("not implemented: ${name}");\n}\n`,
    missing: (stderr) => { const m = String(stderr ?? "").match(/ReferenceError: (\w+) is not defined/); return m ? m[1] : null; },
    mainRe: /\nfunction main\(\)/,
    header: (spec) => `// ${spec}\n\n`,
    bodyRe: (name) => new RegExp(`(function ${name}\\([^)]*\\) \\{\\n(?:  // [^\\n]*\\n)?)([\\s\\S]*?)(?=\\n\\}\\n)`),
    failing: (stderr, names) => { for (const n of names) if (String(stderr ?? "").includes(n)) return n; return null; },
    fence: "js",
    indent: "  ",
  },
});
export const CODE_RUNTIMES = Object.freeze(Object.keys(RUNTIMES));

/** INS + CON + SYN — the skeleton: header, one stub per feature (each fed the previous result), the main pipeline. No model. */
export function skeletonFor(lang, spec, features) {
  const R = RUNTIMES[lang];
  if (!R) throw new TypeError(`code-piece: no skeleton for ${lang} (have ${CODE_RUNTIMES.join(", ")})`);
  const names = namesFor(features);
  const stubs = names.map((n, i) => R.stub(n, features[i], i === 0 ? "" : "previous"));
  const code = R.header(spec) + stubs.join("\n") + "\n" + R.main(names);
  return { names, code, instrumentChars: code.length };
}

/** SEG — the snip: the one function region the model is shown, and the ask for its body alone. */
export function snipFor(lang, code, name, clause, { previousClause = null, previousValue = null, nextClause = null } = {}) {
  const R = RUNTIMES[lang];
  const m = code.match(R.bodyRe(name));
  if (!m) return null;
  const region = m[0];
  // The contract, mechanical: what `previous` is (the step before, and — once
  // the run has witnessed it — its actual type and value), and what the next
  // step will need. Facts the mouth receives, never a rule it is trusted with.
  const contract = [
    previousClause ? `\`previous\` is the result of the step before, which ${previousClause}${previousValue ? ` — when run it was ${previousValue}` : ""}.` : "",
    nextClause ? `Return what the next step needs; the next step ${nextClause}.` : "Return the value the program should end with.",
  ].filter(Boolean).join(" ");
  const ask = `Here is one function of a ${lang} program, exactly as it stands:\n\n\`\`\`${R.fence}\n${region}\n\`\`\`\n\nWrite the body of ${name} so that it does this: ${clause}. Keep the signature. ${contract} Use only what is imported or defined here. Reply with only the function, complete, in one \`\`\`${R.fence} block.`;
  return { region, ask, start: m.index, end: m.index + region.length };
}

/** Splice the model's function back over the stub — the whole function replaced, nothing else touched; refused if the reply is not that function. */
export function spliceFunction(lang, code, name, reply) {
  const R = RUNTIMES[lang];
  const fence = String(reply ?? "").match(/```[a-z]*\n([\s\S]*?)```/i);
  const body = (fence ? fence[1] : String(reply ?? "")).trim();
  const head = lang === "python" ? new RegExp(`^def ${name}\\(`, "m") : new RegExp(`^function ${name}\\(`, "m");
  if (!head.test(body)) return { code, refused: { type: "not_the_function", detail: `the reply does not define ${name}` } };
  const m = code.match(R.bodyRe(name));
  if (!m) return { code, refused: { type: "no_region", detail: `${name} is not in the code` } };
  // take only the function from the reply: from its head to the next top-level line
  const fnRe = lang === "python" ? new RegExp(`(def ${name}\\([^)]*\\):\\n[\\s\\S]*?)(?=\\n\\S|$)`) : new RegExp(`(function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\})`);
  const fm = body.match(fnRe);
  if (!fm) return { code, refused: { type: "unparsed_function", detail: `could not cut ${name} out of the reply` } };
  const fn = fm[1].trimEnd() + "\n";
  const next = code.slice(0, m.index) + fn + code.slice(m.index + m[0].length);
  return { code: next, refused: null, modelChars: fn.length };
}

/** The per-step witnesses the run printed: name → "type: repr". */
export function stepWitnesses(stderr) {
  const out = {};
  for (const m of String(stderr ?? "").matchAll(/\[step (\d+) (\w+)\] ([^\n]*)/g)) out[m[2]] = m[3].trim();
  return out;
}
/** INS in dependency order — a name the run says is not defined becomes a stub before main, to be filled next. */
export function stubMissing(lang, code, stderr) {
  const R = RUNTIMES[lang];
  const name = R.missing(stderr);
  if (!name) return { code, name: null };
  if (new RegExp(`(def|function) ${name}\\(`).test(code)) return { code, name: null };
  const i = code.search(R.mainRe);
  if (i < 0) return { code, name: null };
  return { code: code.slice(0, i) + "\n" + R.helperStub(name) + code.slice(i), name };
}
/** How much of the final code the model wrote: the regions of the named functions, measured off the code itself. */
export function modelRegions(lang, code, names) {
  const R = RUNTIMES[lang];
  let chars = 0;
  for (const n of names) { const m = code.match(R.bodyRe(n)); if (m) chars += m[0].length; }
  return chars;
}
/**
 * Mechanical name repairs, before any model is asked — the runtime's own
 * witness decides:
 *   didYouMean(stderr)           the traceback's own "Did you mean: 'X'?" — a near-miss of a defined name, renamed at its call sites
 *   qualify(lang, code, name, m) an undefined name the sandbox probe found on an imported module — its calls qualified `m.name(`
 */
export function didYouMean(stderr) {
  const m = String(stderr ?? "").match(/NameError: name '([A-Za-z_]\w*)' is not defined\. Did you mean: '([A-Za-z_]\w*)'\?/);
  return m ? { wrong: m[1], right: m[2] } : null;
}
export function renameCalls(code, wrong, right) {
  const re = new RegExp(`\\b${wrong}\\s*\\(`, "g");
  const n = (String(code).match(re) ?? []).length;
  return { code: String(code).replace(re, `${right}(`), count: n };
}
export function qualifyCalls(code, name, module) {
  const re = new RegExp(`(?<![\\w.])${name}\\s*\\(`, "g");
  const n = (String(code).match(re) ?? []).length;
  return { code: String(code).replace(re, `${module}.${name}(`), count: n };
}
/** The probe the sandbox runs to answer "which imported module has this name" — a question the runtime answers, never a list typed here. */
export const moduleProbe = (lang, name, modules) => lang === "python"
  ? `import ${modules.join(", ")}\nprint(",".join(m for m in ${JSON.stringify(modules)} if hasattr(__import__(m), ${JSON.stringify(name)})))`
  : null;
/** The modules the skeleton itself imports, read off its own header. */
export function importedModules(lang, code) {
  if (lang !== "python") return [];
  return [...String(code).matchAll(/^import (\w+)/gm)].map((m) => m[1]);
}
/** REC — which function the run's own last line names, or null. */
export const failingFunction = (lang, stderr, names) => RUNTIMES[lang].failing(stderr, names);

/**
 * REC's real decision (task_434c33fd): which function does a failing run
 * blame? `failingFunction` reads a STACK FRAME — python's "in <name>" line,
 * js's crude name-substring check — and both correctly say null when no
 * frame exists to read, which is exactly what a parse-time SyntaxError is:
 * thrown before the interpreter ever enters a function, so nobody's name is
 * anywhere in the message (confirmed live: term-js-worker.mjs posts a bare
 * `${e.name}: ${e.message}`, no stack at all, for a stray brace). Both
 * languages have this same hole, equally — `failingFunction`'s own pinned
 * test already says so for python (`"SyntaxError: invalid syntax"` → null)
 * and this file's test says so for js too. A caller mid-step (`app.js`'s
 * `repair`) knows one more fact no bare stderr string carries, though: the
 * function it JUST landed is the only code that changed since the last run
 * that got far enough to parse at all — so when, and only when, the failure
 * IS a SyntaxError (never guessed at for any other unattributed failure),
 * that function is blamed by construction. A frame `failingFunction` DID
 * name always wins outright; this is a fallback for the one case it is
 * structurally unable to name anyone.
 */
export function attributedFailure(lang, stderr, names, current) {
  const named = failingFunction(lang, stderr, names);
  if (named) return named;
  return /SyntaxError/.test(String(stderr ?? "")) ? current : null;
}

/** How much of the program the model wrote. */
export const modelShare = (modelChars, totalChars) => (totalChars ? modelChars / totalChars : null);
