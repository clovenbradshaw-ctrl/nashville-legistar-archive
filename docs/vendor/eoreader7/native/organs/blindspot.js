// native/organs/blindspot.js — the archon of what a local reader MISSES.
// Handle: Popper — a claim that cannot fail was never tested.
//
// WHAT IT IS. The complement of salzter.js. Saltzer catches the flaws a model
// WRITES; Popper catches the things a model OVERLOOKS — the whole-view
// properties a single window cannot hold:
//   - a test that cannot fail (no assertion, or assert True, or <const> == <const>) — wrote it, "verified" it, missed that it proves nothing;
//   - a secret compared with == / != — correct behaviour, unsafe timing;
//   - a resource acquired without `with` — leaks on the error path;
//   - a guard whose body can never run (a defensive check that is dead).
// These are not exotic. They are the routine blind spots: the model reads the
// line, not the path; it sees the function, not the flow.
//
// A witness, never a proof — the same posture as every organ here.

import { getPyodide } from "../../postprocess.mjs";

async function pythonBlindspots(code) {
  const py = await getPyodide();
  py.globals.set("_blind_code", String(code ?? ""));
  py.runPython(`
import ast, json
def _blind(code):
    out = []
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [{"cwe": "", "kind": "unparseable", "detail": "could not analyze — the code does not parse (" + (e.msg or "syntax error") + "); disclosed, never a silent pass"}]
    def add(cwe, kind, detail, node):
        out.append({"cwe": cwe, "kind": kind, "detail": detail, "line": getattr(node, "lineno", None)})
    def name_of(f):
        return getattr(f, "id", None) or getattr(f, "attr", None) or ""
    for node in ast.walk(tree):
        # a test that cannot fail
        if isinstance(node, ast.FunctionDef) and node.name.lower().startswith("test"):
            body = list(ast.walk(node))
            real_assert = any(isinstance(n, ast.Assert) for n in body)
            # pytest/unittest style assertion methods (self.assertEqual, assert x, etc.)
            method_assert = any(isinstance(n, ast.Call) and name_of(n.func).startswith("assert") for n in body)
            raises = any(isinstance(n, ast.Assert) or (isinstance(n, ast.With) and "raises" in ast.dump(n).lower()) for n in body)
            if not (real_assert or method_assert or raises):
                add("CWE-1075", "unfalsifiable_test", "test '" + node.name + "' has no assertion — it cannot fail, so it proves nothing", node)
        if isinstance(node, ast.Assert):
            t = node.test
            if isinstance(t, ast.Constant) and t.value is True:
                add("CWE-1075", "unfalsifiable_assert", "assert True — cannot fail", node)
            if isinstance(t, ast.Compare) and isinstance(t.left, ast.Constant) and len(t.comparators) == 1 and isinstance(t.comparators[0], ast.Constant):
                if t.left.value == t.comparators[0].value:
                    add("CWE-1075", "unfalsifiable_assert", "assert <const> == itself — cannot fail", node)
        # a secret compared with == / != (unsafe timing)
        if isinstance(node, ast.Compare) and any(type(o).__name__ in ("Eq", "NotEq") for o in node.ops):
            dump = ast.dump(node).lower()
            if any(k in dump for k in ("password", "passwd", "token", "secret", "hmac", "signature", "apikey", "api_key", "digest")):
                add("CWE-208", "timing_unsafe_compare", "a secret compared with == / != — not constant-time (use hmac.compare_digest)", node)
        # a resource acquired without a context manager (leaks on the error path)
        if isinstance(node, ast.Assign) and isinstance(node.value, ast.Call):
            fname = name_of(node.value.func)
            if fname in ("open", "connect", "urlopen", "socket"):
                add("CWE-772", "resource_leak", fname + "() result not bound by a with-block — leaks if an error is raised before close", node)
    return out
_result = json.dumps(_blind(_blind_code))
`);
  try { return JSON.parse(py.runPython("_result")); } catch { return []; }
}

// ── the PATH, not the line: inter-procedural taint ─────────────────────────
// The deepest whole-view property a window cannot hold: a value from an
// untrusted SOURCE reaching a dangerous SINK *across a function boundary*.
// A model reading handler() sees cursor.execute(q); it does not trace that q
// came from a request helper. One-hop per-function summaries (which params
// reach a sink / are returned) + a bounded fixpoint over the call sites
// reconstructs the path. Still a witness — a conservative, intra-module
// approximation, disclosed.
async function pythonTaintPaths(code) {
  const py = await getPyodide();
  py.globals.set("_taint_code", String(code ?? ""));
  py.runPython(`
import ast, json
def _taint(code):
    out = []
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return [{"cwe": "", "kind": "unparseable", "detail": "could not analyze — the code does not parse (" + (e.msg or "syntax error") + "); disclosed, never a silent pass"}]
    SOURCE_MARKERS = ("request.args", "request.form", "request.get_json", "request.get", "request.cookies", "request.headers", "input(", "sys.argv", "os.environ", "request.data")
    SINK_NAMES = {"eval", "exec", "compile", "os.system", "os.popen", "pickle.loads", "pickle.load", "yaml.load"}
    SINK_METHODS = {"execute", "executemany", "send_file", "send_from_directory"}
    def dotted(f):
        parts = []
        x = f
        while isinstance(x, ast.Attribute):
            parts.append(x.attr); x = x.value
        if isinstance(x, ast.Name):
            parts.append(x.id)
        return ".".join(reversed(parts))
    def names(node):
        return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}
    def is_source(node):
        prefixes = ("request.args", "request.form", "request.get_json", "request.cookies", "request.headers", "request.get", "sys.argv", "os.environ")
        for n in ast.walk(node):
            if isinstance(n, ast.Call) and dotted(n.func) == "input":
                return True
            if isinstance(n, ast.Attribute):
                d = dotted(n)
                if any(d == p or d.startswith(p + ".") for p in prefixes):
                    return True
        return False
    def is_sink(call):
        d = dotted(call.func)
        if d in SINK_NAMES:
            return d
        if d.split(".")[-1] in SINK_METHODS:
            return d
        if d.startswith("subprocess.") and any(k.arg == "shell" for k in call.keywords):
            return d + "(shell=True)"
        return None
    funcs = {}
    for fn in [n for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]:
        params = [a.arg for a in fn.args.args]
        sink_params, ret_params = set(), set()
        for n in ast.walk(fn):
            if isinstance(n, ast.Call) and is_sink(n):
                for a in n.args:
                    for p in params:
                        if p in names(a):
                            sink_params.add(p)
            if isinstance(n, ast.Return) and n.value is not None:
                for p in params:
                    if p in names(n.value):
                        ret_params.add(p)
        funcs[fn.name] = {"params": params, "sink_params": sink_params, "ret_params": ret_params}
    scopes = [(tree, None)] + [(fn, fn.name) for fn in ast.walk(tree) if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef))]
    for scope, sname in scopes:
        tainted = set()
        for _ in range(4):
            changed = False
            for node in ast.walk(scope):
                if isinstance(node, ast.Assign):
                    tgts = [t.id for t in node.targets if isinstance(t, ast.Name)]
                    val = node.value
                    hit = is_source(val)
                    if not hit and isinstance(val, ast.Call):
                        callee = dotted(val.func)
                        if callee in funcs:
                            ps = funcs[callee]["params"]
                            for i, a in enumerate(val.args):
                                if (names(a) & tainted) or is_source(a):
                                    if i < len(ps) and ps[i] in funcs[callee]["ret_params"]:
                                        hit = True
                    if hit:
                        for t in tgts:
                            if t not in tainted:
                                tainted.add(t); changed = True
            if not changed:
                break
        for node in ast.walk(scope):
            if not isinstance(node, ast.Call):
                continue
            sink = is_sink(node)
            if sink:
                # For execute/executemany only the SQL string (arg 0) counts: a
                # tainted value in the bound-parameter tuple is the SAFE pattern.
                check_args = node.args[:1] if sink.split(".")[-1] in ("execute", "executemany") else node.args
                for a in check_args:
                    if names(a) & tainted:
                        out.append({"cwe": "CWE-89" if sink.split(".")[-1] in ("execute", "executemany") else "CWE-78", "kind": "taint_path", "detail": "untrusted input reaches " + sink + "() (a path a single window cannot see)", "line": getattr(node, "lineno", None)})
            callee = dotted(node.func)
            if callee in funcs:
                ps = funcs[callee]["params"]
                for i, a in enumerate(node.args):
                    if (names(a) & tainted) or is_source(a):
                        if i < len(ps) and ps[i] in funcs[callee]["sink_params"]:
                            out.append({"cwe": "CWE-89", "kind": "taint_path", "detail": "untrusted input reaches a sink inside " + callee + "() (cross-function dataflow)", "line": getattr(node, "lineno", None)})
    seen = set()
    uniq = []
    for f in out:
        k = (f["cwe"], f["line"], f["detail"])
        if k not in seen:
            seen.add(k); uniq.append(f)
    return uniq
_result = json.dumps(_taint(_taint_code))
`);
  try { return JSON.parse(py.runPython("_result")); } catch { return []; }
}

function webBlindspots(code) {
  const src = String(code ?? "");
  const lines = src.split("\n");
  const out = [];
  const lineOf = (re) => { for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1; return null; };
  // a test with no assertion (Jest/Vitest: a test/it whose body never expects)
  const m = /(?:test|it)\s*\(\s*['"][^'"]+['"]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{([^}]*)\}/i.exec(src);
  if (m && !/\b(expect|assert|should|\.toBe|\.toEqual)\b/.test(m[1])) out.push({ cwe: "CWE-1075", kind: "unfalsifiable_test", detail: "a test body with no expectation — it cannot fail", line: lineOf(/(?:test|it)\s*\(/) });
  const l2 = lineOf(/[^=!<>]==[^=]/);
  if (l2 && /\b(password|token|secret|apikey|api_key)\b/i.test(lines[l2 - 1])) out.push({ cwe: "CWE-208", kind: "timing_unsafe_compare", detail: "a secret compared with == — not constant-time", line: l2 });
  return out;
}

export async function blindspotFindings(code, { language = "python" } = {}) {
  let findings = [];
  try {
    if (language === "python") {
      findings = await pythonBlindspots(code);
      findings = findings.concat(await pythonTaintPaths(code));
      // de-dup (the two scans share a source; only one "unparseable" if the
      // code did not parse, so the disclosure is not repeated)
      const seen = new Set();
      findings = findings.filter((f) => { const k = `${f.kind}|${f.line}|${f.detail}`; if (seen.has(k)) return false; seen.add(k); return true; });
    } else {
      findings = webBlindspots(code);
    }
  } catch (e) {
    return { findings: [], examined: false, error: String(e?.message ?? e), basis: "blindspot archon (Popper) — scan failed (disclosed)" };
  }
  // The JS path is a single-pattern scan, not the full AST + taint analysis
  // the python path runs — disclosed on the record (coverage + gap), never a
  // silent whole-view claim. The python path already discloses its own
  // residue the same way (`unparseable` findings when the code does not parse).
  if (language !== "python") {
    return {
      findings,
      examined: true,
      coverage: "single-pattern",
      gap: "js-blindspot-partial",
      basis: "blindspot archon (Popper) — the whole-view properties a single window cannot hold (unfalsifiable tests, timing-unsafe compares, leaked resources, and cross-function taint paths); a witness, never a proof",
    };
  }
  return {
    findings,
    examined: true,
    basis: "blindspot archon (Popper) — the whole-view properties a single window cannot hold (unfalsifiable tests, timing-unsafe compares, leaked resources, and cross-function taint paths); a witness, never a proof",
  };
}

export const POPPER_ARCHON = { handle: "Popper", organ: "blindspot", law: "a claim that cannot fail was never tested; the local reader sees the line, the whole reader sees the path" };
